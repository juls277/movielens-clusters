package fullpir

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/ahenzinger/simplepir/pir"
)

type Catalog struct {
	Names      []string `json:"names"`
	RecordSize int      `json:"recordSize"`
	Version    string   `json:"version"`
}

// movie contains the fields that will be privately retrieved.
type Movie struct {
	ID     int64    `json:"id"`
	Genres []string `json:"genres"`
}

// LoadClusters reads all cluster files and creates equal-sized PIR records.
func LoadClusters(root string) (Catalog, [][]byte, error) {
	var names []string

	// Find all single-genre and genre-pair cluster files.
	for _, kind := range []string{"single", "pairs"} {
		directory := filepath.Join(root, kind)

		entries, err := os.ReadDir(directory)
		if err != nil {
			return Catalog{}, nil, err
		}

		for _, entry := range entries {
			// ignore not json
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}

			// Convert "Drama.json" into the public name "single/Drama".
			filename := strings.TrimSuffix(entry.Name(), ".json")
			name := kind + "/" + filename

			names = append(names, name)
		}
	}

	// order to determive pir index of every cluster
	sort.Strings(names)

	if len(names) < 2 {
		return Catalog{}, nil, fmt.Errorf(
			"need at least two clusters, found %d",
			len(names),
		)
	}

	// one compressed cluster
	compressed := make([][]byte, len(names))

	// get the largest size for equal padding
	maxLength := 0

	for index, name := range names {

		path := filepath.Join(
			root,
			filepath.FromSlash(name)+".json",
		)

		rawJSON, err := os.ReadFile(path)
		if err != nil {
			return Catalog{}, nil, err
		}

		var movies []Movie

		if err := json.Unmarshal(rawJSON, &movies); err != nil {
			return Catalog{}, nil, fmt.Errorf(
				"%s: %w",
				name,
				err,
			)
		}

		// Serialize the complete cluster using only ID and genres.
		clusterJSON, err := json.Marshal(movies)
		if err != nil {
			return Catalog{}, nil, err
		}

		// Compress the cluster to reduce PIR record size.
		var buffer bytes.Buffer
		gzipWriter := gzip.NewWriter(&buffer)

		if _, err := gzipWriter.Write(clusterJSON); err != nil {
			return Catalog{}, nil, err
		}

		if err := gzipWriter.Close(); err != nil {
			return Catalog{}, nil, err
		}

		compressed[index] = buffer.Bytes()

		// Find the largest compressed cluster.
		if len(compressed[index]) > maxLength {
			maxLength = len(compressed[index])
		}
	}

	digest := sha256.New()

	// layout changes here
	digest.Write([]byte("simplepir-column-layout-v2"))

	for index, name := range names {
		// Include both the cluster name and its data.
		digest.Write([]byte(name))

		// Separate the name from the binary data.
		digest.Write([]byte{0})

		digest.Write(compressed[index])
	}

	version := hex.EncodeToString(digest.Sum(nil))

	// Every record begins with a four-byte compressed-data length.
	recordSize := 4 + maxLength

	// records contains one equal-sized byte record per cluster.
	records := make([][]byte, len(names))

	for index, payload := range compressed {
		// make fills the record with zeros.
		// Those zeros become padding after the real payload.
		record := make([]byte, recordSize)

		// Store the real compressed length in bytes 0 through 3.
		binary.LittleEndian.PutUint32(
			record[:4],
			uint32(len(payload)),
		)

		// Store the compressed cluster after the length.
		copy(record[4:], payload)

		records[index] = record
	}

	catalog := Catalog{
		Names:      names,
		RecordSize: recordSize,
		Version:    version,
	}

	return catalog, records, nil
}

func Parameters(count int) (pir.Params, pir.DBinfo, uint64, error) {
	scheme := pir.SimplePIR{}

	params := scheme.PickParamsGivenDimensions(
		1,             //one db row
		uint64(count), //one column for every cluster
		1<<10,         //1024, the LWE secret dimension
		32,            //use 32-bit modus
	)
	// l = rows, m = cols
	slots := params.L * params.M

	database := pir.SetupDB(slots, 8, &params)
	info := database.Info

	if params.L != 1 ||
		params.M != uint64(count) ||
		params.P <= 255 ||
		info.Ne != 1 ||
		info.Packing != 1 {
		return params, info, slots, fmt.Errorf(
			"unsupported SimplePIR byte layout",
		)
	}

	return params, info, slots, nil
}

func WriteMatrix(writer io.Writer, matrix *pir.Matrix) error {
	valueCount := matrix.Rows * matrix.Cols
	//alloc 4 bytes per value
	data := make([]byte, valueCount*4)

	for row := uint64(0); row < matrix.Rows; row++ {
		for column := uint64(0); column < matrix.Cols; column++ {
			position := row*matrix.Cols + column
			bytePosition := position * 4
			value := matrix.Get(row, column)
			binary.LittleEndian.PutUint32(
				data[bytePosition:bytePosition+4],
				uint32(value),
			)
		}
	}

	_, err := writer.Write(data)
	return err
}

// / convert receives bytes back into matrix
func ReadMatrix(
	reader io.Reader,
	rows uint64,
	columns uint64,
) (*pir.Matrix, error) {
	byteCount := rows * columns * 4
	data := make([]byte, byteCount)
	if _, err := io.ReadFull(reader, data); err != nil {
		return nil, err
	}
	matrix := pir.MatrixNew(rows, columns)
	for row := uint64(0); row < rows; row++ {
		for column := uint64(0); column < columns; column++ {
			position := row*columns + column
			bytePosition := position * 4

			value := binary.LittleEndian.Uint32(
				data[bytePosition : bytePosition+4],
			)
			matrix.Set(
				uint64(value),
				row,
				column,
			)
		}
	}

	return matrix, nil
}

// DECODE ONE FULL PADDED RECORD
func DecodeRecord(record []byte) ([]Movie, error) {
	//ensure length exists
	if len(record) < 4 {
		return nil, fmt.Errorf("record is too short")
	}

	compressedLength := int(
		binary.LittleEndian.Uint32(record[:4]),
	)

	if compressedLength > len(record)-4 {
		return nil, fmt.Errorf("invalid compressed length")
	}

	compressedData := record[4 : 4+compressedLength]

	gzipReader, err := gzip.NewReader(
		bytes.NewReader(compressedData),
	)
	if err != nil {
		return nil, err
	}
	defer gzipReader.Close()

	clusterJSON, err := io.ReadAll(gzipReader)
	if err != nil {
		return nil, err
	}

	var movies []Movie

	if err := json.Unmarshal(clusterJSON, &movies); err != nil {
		return nil, err
	}
	return movies, nil
}
