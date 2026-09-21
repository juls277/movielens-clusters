package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/ahenzinger/simplepir/pir"

	"movielens-clusters/pir-prototype/fullpir"
)

func main() {
	serverURL := flag.String(
		"server",
		"http://127.0.0.1:3001",
		"PIR server URL",
	)

	clusterName := flag.String(
		"cluster",
		"",
		"cluster to retrieve privately",
	)

	listOnly := flag.Bool(
		"list",
		false,
		"list available clusters",
	)

	cacheDir := flag.String(
		"cache-dir",
		".pir-cache",
		"directory for the reusable PIR setup",
	)

	flag.Parse()

	catalogURL := strings.TrimRight(
		*serverURL,
		"/",
	) + "/catalog"

	// DOWNLOAD PUBLIC CATALOG
	response, err := http.Get(catalogURL)
	if err != nil {
		log.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		log.Fatalf(
			"catalog request failed: %s",
			response.Status,
		)
	}

	var catalog fullpir.Catalog

	if err := json.NewDecoder(response.Body).Decode(
		&catalog,
	); err != nil {
		log.Fatal(err)
	}

	if *listOnly {
		for _, name := range catalog.Names {
			fmt.Println(name)
		}
		return
	}

	if *clusterName == "" {
		log.Fatal("use -cluster with a name from -list")
	}

	chosenIndex := -1

	for index, name := range catalog.Names {
		if name == *clusterName {
			chosenIndex = index
			break
		}
	}

	if chosenIndex < 0 {
		log.Fatalf(
			"cluster %q was not found; use -list",
			*clusterName,
		)
	}

	log.Printf(
		"selected %s at local column %d",
		*clusterName,
		chosenIndex,
	)

	params, info, slots, err := fullpir.Parameters(
		len(catalog.Names),
	)
	if err != nil {
		log.Fatal(err)
	}

	publicMatrixBytes := int64(
		params.M * params.N * 4,
	)

	hintBytes := int64(
		uint64(catalog.RecordSize) * params.N * 4,
	)

	expectedCacheBytes := publicMatrixBytes + hintBytes
	cacheFilename := "setup-" + catalog.Version + ".bin"
	cachePath := filepath.Join(*cacheDir, cacheFilename)

	cacheInfo, cacheErr := os.Stat(cachePath)
	cacheExists := cacheErr == nil &&
		cacheInfo.Size() == expectedCacheBytes

	if cacheExists {
		log.Printf("reusing setup cache: %s", cachePath)
	} else {
		log.Printf("downloading reusable setup")

		if err := os.MkdirAll(*cacheDir, 0755); err != nil {
			log.Fatal(err)
		}

		setupURL := strings.TrimRight(
			*serverURL,
			"/",
		) + "/setup"

		setupResponse, err := http.Get(setupURL)
		if err != nil {
			log.Fatal(err)
		}
		defer setupResponse.Body.Close()

		if setupResponse.StatusCode != http.StatusOK {
			log.Fatalf(
				"setup request failed: %s",
				setupResponse.Status,
			)
		}

		temporaryFile, err := os.CreateTemp(
			*cacheDir,
			"setup-*.tmp",
		)
		if err != nil {
			log.Fatal(err)
		}

		temporaryPath := temporaryFile.Name()
		defer os.Remove(temporaryPath)

		written, err := io.CopyN(
			temporaryFile,
			setupResponse.Body,
			expectedCacheBytes,
		)
		if err != nil {
			temporaryFile.Close()
			log.Fatal(err)
		}

		var extra [1]byte
		extraCount, extraErr := setupResponse.Body.Read(extra[:])
		if extraCount != 0 || extraErr != io.EOF {
			temporaryFile.Close()
			log.Fatal("setup response has an unexpected size")
		}

		if err := temporaryFile.Close(); err != nil {
			log.Fatal(err)
		}

		if err := os.Rename(
			temporaryPath,
			cachePath,
		); err != nil {
			log.Fatal(err)
		}

		log.Printf(
			"saved %d setup bytes to %s",
			written,
			cachePath,
		)
	}

	cacheFile, err := os.Open(cachePath)
	if err != nil {
		log.Fatal(err)
	}
	defer cacheFile.Close()

	publicMatrix, err := fullpir.ReadMatrix(
		cacheFile,
		params.M,
		params.N,
	)
	if err != nil {
		log.Fatal(err)
	}

	params.L = uint64(catalog.RecordSize)
	info.Num = slots * uint64(catalog.RecordSize)
	info.Squishing = 3

	sharedState := pir.MakeState(publicMatrix)
	scheme := pir.SimplePIR{}

	clientState, query := scheme.Query(
		uint64(chosenIndex),
		sharedState,
		params,
		info,
	)

	var queryBody bytes.Buffer
	if err := fullpir.WriteMatrix(
		&queryBody,
		query.Data[0],
	); err != nil {
		log.Fatal(err)
	}

	queryURL := strings.TrimRight(
		*serverURL,
		"/",
	) + "/query"

	queryResponse, err := http.Post(
		queryURL,
		"application/octet-stream",
		&queryBody,
	)
	if err != nil {
		log.Fatal(err)
	}
	defer queryResponse.Body.Close()

	if queryResponse.StatusCode != http.StatusOK {
		log.Fatalf(
			"query request failed: %s",
			queryResponse.Status,
		)
	}

	answerMatrix, err := fullpir.ReadMatrix(
		queryResponse.Body,
		params.L,
		1,
	)
	if err != nil {
		log.Fatal(err)
	}

	hintMatrix, err := fullpir.ReadMatrix(
		cacheFile,
		params.L,
		params.N,
	)
	if err != nil {
		log.Fatal(err)
	}

	var extraAnswer [1]byte
	extraCount, extraErr := queryResponse.Body.Read(extraAnswer[:])
	if extraCount != 0 || extraErr != io.EOF {
		log.Fatal("query response has an unexpected size")
	}

	maskedAnswer := pir.MatrixMul(
		hintMatrix,
		clientState.Data[0],
	)

	var offsetSum uint64
	for row := uint64(0); row < params.M; row++ {
		offsetSum += (params.P / 2) *
			query.Data[0].Get(row, 0)
	}

	modulus := uint64(1) << params.Logq
	correction := modulus - offsetSum%modulus
	record := make([]byte, catalog.RecordSize)

	for bytePosition := 0; bytePosition < catalog.RecordSize; bytePosition++ {
		answerValue := uint32(
			answerMatrix.Get(uint64(bytePosition), 0),
		)
		maskValue := uint32(
			maskedAnswer.Get(uint64(bytePosition), 0),
		)
		difference := answerValue - maskValue

		rounded := params.Round(
			uint64(difference) + correction,
		)
		entryIndex :=
			uint64(bytePosition)*slots +
				uint64(chosenIndex)

		record[bytePosition] = byte(
			pir.ReconstructElem(
				[]uint64{rounded},
				entryIndex,
				info,
			),
		)
	}

	movies, err := fullpir.DecodeRecord(record)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf(
		"Recovered %s with %d movies\n",
		*clusterName,
		len(movies),
	)

	sampleSize := 5
	if len(movies) < sampleSize {
		sampleSize = len(movies)
	}

	for _, movie := range movies[:sampleSize] {
		fmt.Printf(
			"id=%d genres=%v\n",
			movie.ID,
			movie.Genres,
		)
	}
}
