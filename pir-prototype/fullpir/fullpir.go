package fullpir

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const BlockBytes = 32

type Catalog struct {
	Names      []string `json:"names"`
	RecordSize int      `json:"recordSize"`
	Version    string   `json:"version"`
}

// movie contains the fields that will be privately retrieved.
type movie struct {
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

	// The order determines the PIR index of every cluster.
	sort.Strings(names)

	if len(names) < 2 {
		return Catalog{}, nil, fmt.Errorf(
			"need at least two clusters, found %d",
			len(names),
		)
	}

	// Each element will contain one compressed complete cluster.
	compressed := make([][]byte, len(names))

	// We need the largest size so all records can be padded equally.
	maxLength := 0

	for index, name := range names {
		// Convert "single/Drama" into:
		// "../data/processed/single/Drama.json".
		path := filepath.Join(
			root,
			filepath.FromSlash(name)+".json",
		)

		// Read the original complete cluster file.
		rawJSON, err := os.ReadFile(path)
		if err != nil {
			return Catalog{}, nil, err
		}

		// Decode every movie in this cluster.
		// Go keeps ID and genres and ignores unrelated source fields.
		var movies []movie

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

		// Closing finishes the gzip stream.
		if err := gzipWriter.Close(); err != nil {
			return Catalog{}, nil, err
		}

		compressed[index] = buffer.Bytes()

		// Find the largest compressed cluster.
		if len(compressed[index]) > maxLength {
			maxLength = len(compressed[index])
		}
	}

	// Create a fingerprint for this data and database layout.
	digest := sha256.New()

	// If we later change the layout, we change this string.
	digest.Write([]byte("simplepir-column-layout-v2"))

	for index, name := range names {
		// Include both the cluster name and its data.
		digest.Write([]byte(name))

		// Separate the name from the binary data.
		digest.Write([]byte{0})

		digest.Write(compressed[index])
	}

	// Convert the fingerprint into a hexadecimal string.
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
