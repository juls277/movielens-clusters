package pirclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/ahenzinger/simplepir/pir"

	"movielens-clusters/pir-prototype/fullpir"
)

type Retriever struct {
	serverURL string
	cacheDir  string
	client    *http.Client
	setupMu   sync.Mutex
}

func New(serverURL string, cacheDir string) *Retriever {
	serverURL = strings.TrimRight(serverURL, "/")

	return &Retriever{
		serverURL: serverURL,
		cacheDir:  cacheDir,
		client: &http.Client{
			Timeout: 5 * time.Minute,
		},
	}
}

func (retriever *Retriever) Catalog() (fullpir.Catalog, error) {
	response, err := retriever.client.Get(retriever.serverURL + "/catalog")
	if err != nil {
		return fullpir.Catalog{}, fmt.Errorf("download catalog: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fullpir.Catalog{}, fmt.Errorf(
			"download catalog: server returned %s",
			response.Status,
		)
	}

	var catalog fullpir.Catalog
	if err := json.NewDecoder(response.Body).Decode(&catalog); err != nil {
		return fullpir.Catalog{}, fmt.Errorf("decode catalog: %w", err)
	}

	if len(catalog.Names) < 2 {
		return fullpir.Catalog{}, fmt.Errorf("catalog contains fewer than two clusters")
	}
	if catalog.RecordSize < 4 {
		return fullpir.Catalog{}, fmt.Errorf("catalog record size is invalid")
	}
	if catalog.Version == "" {
		return fullpir.Catalog{}, fmt.Errorf("catalog version is missing")
	}

	return catalog, nil
}

func clusterIndex(catalog fullpir.Catalog, clusterName string) (uint64, error) {
	for index, name := range catalog.Names {
		if name == clusterName {
			return uint64(index), nil
		}
	}

	return 0, fmt.Errorf("cluster %q is not in the catalog", clusterName)
}

func (retriever *Retriever) setupFileInfo(
	catalog fullpir.Catalog,
	params pir.Params,
) (string, int64) {
	publicMatrixBytes := int64(
		params.M * params.N * 4,
	)

	hintBytes := int64(
		uint64(catalog.RecordSize) *
			params.N *
			4,
	)

	expectedBytes := publicMatrixBytes + hintBytes
	filename := "setup-" + catalog.Version + ".bin"

	path := filepath.Join(
		retriever.cacheDir,
		filename,
	)

	return path, expectedBytes
}
func (retriever *Retriever) openSetup(
	catalog fullpir.Catalog,
	params pir.Params,
) (*os.File, error) {
	retriever.setupMu.Lock()
	defer retriever.setupMu.Unlock()

	path, expectedBytes := retriever.setupFileInfo(catalog, params)

	info, err := os.Stat(path)
	if err == nil && info.Size() == expectedBytes {
		file, err := os.Open(path)
		if err != nil {
			return nil, fmt.Errorf("open setup cache: %w", err)
		}
		return file, nil
	}
	if err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("inspect setup cache: %w", err)
	}
	if err == nil {
		if err := os.Remove(path); err != nil {
			return nil, fmt.Errorf("remove invalid setup cache: %w", err)
		}
	}

	if err := os.MkdirAll(retriever.cacheDir, 0755); err != nil {
		return nil, fmt.Errorf("create setup cache directory: %w", err)
	}

	response, err := retriever.client.Get(retriever.serverURL + "/setup")
	if err != nil {
		return nil, fmt.Errorf("download setup: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"download setup: server returned %s",
			response.Status,
		)
	}

	temporaryFile, err := os.CreateTemp(retriever.cacheDir, "setup-*.tmp")
	if err != nil {
		return nil, fmt.Errorf("create temporary setup cache: %w", err)
	}
	temporaryPath := temporaryFile.Name()
	defer os.Remove(temporaryPath)

	written, copyErr := io.CopyN(temporaryFile, response.Body, expectedBytes)
	if copyErr != nil {
		temporaryFile.Close()
		return nil, fmt.Errorf("save setup cache after %d bytes: %w", written, copyErr)
	}

	var extra [1]byte
	extraCount, extraErr := response.Body.Read(extra[:])
	if extraCount != 0 || extraErr != io.EOF {
		temporaryFile.Close()
		return nil, fmt.Errorf("setup response has an unexpected size")
	}

	if err := temporaryFile.Close(); err != nil {
		return nil, fmt.Errorf("close temporary setup cache: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return nil, fmt.Errorf("publish setup cache: %w", err)
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open downloaded setup cache: %w", err)
	}
	return file, nil
}
func (retriever *Retriever) Retrieve(clusterName string) ([]fullpir.Movie, error) {
	catalog, err := retriever.Catalog()
	if err != nil {
		return nil, err
	}

	chosenIndex, err := clusterIndex(catalog, clusterName)
	if err != nil {
		return nil, err
	}

	params, info, slots, err := fullpir.Parameters(len(catalog.Names))
	if err != nil {
		return nil, fmt.Errorf("choose PIR parameters: %w", err)
	}

	setupFile, err := retriever.openSetup(catalog, params)
	if err != nil {
		return nil, err
	}
	defer setupFile.Close()

	publicMatrix, err := fullpir.ReadMatrix(setupFile, params.M, params.N)
	if err != nil {
		return nil, fmt.Errorf("read public matrix: %w", err)
	}

	params.L = uint64(catalog.RecordSize)
	info.Num = slots * uint64(catalog.RecordSize)
	info.Squishing = 3

	scheme := pir.SimplePIR{}
	sharedState := pir.MakeState(publicMatrix)
	clientState, query := scheme.Query(
		chosenIndex,
		sharedState,
		params,
		info,
	)

	var queryBody bytes.Buffer
	if err := fullpir.WriteMatrix(&queryBody, query.Data[0]); err != nil {
		return nil, fmt.Errorf("encode PIR query: %w", err)
	}

	response, err := retriever.client.Post(
		retriever.serverURL+"/query",
		"application/octet-stream",
		&queryBody,
	)
	if err != nil {
		return nil, fmt.Errorf("send PIR query: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"send PIR query: server returned %s",
			response.Status,
		)
	}

	answerMatrix, err := fullpir.ReadMatrix(response.Body, params.L, 1)
	if err != nil {
		return nil, fmt.Errorf("read PIR answer: %w", err)
	}

	var extraAnswer [1]byte
	extraCount, extraErr := response.Body.Read(extraAnswer[:])
	if extraCount != 0 || extraErr != io.EOF {
		return nil, fmt.Errorf("PIR answer has an unexpected size")
	}

	hintMatrix, err := fullpir.ReadMatrix(setupFile, params.L, params.N)
	if err != nil {
		return nil, fmt.Errorf("read setup hint: %w", err)
	}

	maskedAnswer := pir.MatrixMul(hintMatrix, clientState.Data[0])

	var offsetSum uint64
	for row := uint64(0); row < params.M; row++ {
		offsetSum += (params.P / 2) * query.Data[0].Get(row, 0)
	}

	modulus := uint64(1) << params.Logq
	correction := modulus - offsetSum%modulus
	record := make([]byte, catalog.RecordSize)

	for bytePosition := 0; bytePosition < catalog.RecordSize; bytePosition++ {
		answerValue := uint32(answerMatrix.Get(uint64(bytePosition), 0))
		maskValue := uint32(maskedAnswer.Get(uint64(bytePosition), 0))
		difference := answerValue - maskValue
		rounded := params.Round(uint64(difference) + correction)
		entryIndex := uint64(bytePosition)*slots + chosenIndex

		record[bytePosition] = byte(pir.ReconstructElem(
			[]uint64{rounded},
			entryIndex,
			info,
		))
	}

	movies, err := fullpir.DecodeRecord(record)
	if err != nil {
		return nil, fmt.Errorf("decode recovered cluster: %w", err)
	}
	return movies, nil
}
