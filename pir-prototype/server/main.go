package main

import (
	"bytes"
	"flag"
	"io"
	"log"

	"movielens-clusters/pir-prototype/fullpir"

	"github.com/ahenzinger/simplepir/pir"

	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
)

func main() {
	dataDir := flag.String(
		"data",
		"../data/processed",
		"directory containing the cluster files",
	)

	address := flag.String(
		"listen",
		"127.0.0.1:3001",
		"HTTP server address",
	)

	flag.Parse()

	//load cluster records
	catalog, records, err := fullpir.LoadClusters(*dataDir)
	if err != nil {
		log.Fatal(err)
	}

	//layout
	params, info, slots, err := fullpir.Parameters(len(catalog.Names))

	if err != nil {
		log.Fatal(err)
	}

	log.Printf(
		"loaded %d clusters; record size=%d; columns=%d; slots=%d; p=%d",
		len(records),
		catalog.RecordSize,
		params.M,
		slots,
		info.P,
	)

	params.L = uint64(catalog.RecordSize)

	info.Num = slots * uint64(catalog.RecordSize)

	matrix := pir.MatrixNew(params.L, params.M)

	for bytePosition := 0; bytePosition < catalog.RecordSize; bytePosition++ {
		for clusterIndex := range records {
			value := records[clusterIndex][bytePosition]
			matrix.Set(
				uint64(value),
				uint64(bytePosition),
				uint64(clusterIndex),
			)
		}
	}
	//center around 0
	matrix.Sub(params.P / 2)

	database := &pir.Database{
		Info: info,
		Data: matrix,
	}

	log.Printf(
		"PIR matrix ready: %d rows x %d columns",
		database.Data.Rows,
		database.Data.Cols,
	)

	//REUSABLE HINT

	scheme := pir.SimplePIR{}

	//public matrix A
	sharedState := scheme.Init(database.Info, params)
	publicMatrix := sharedState.Data[0]

	setupDigest := sha256.New()
	//curr db version
	setupDigest.Write([]byte(catalog.Version))
	if err := fullpir.WriteMatrix(
		setupDigest,
		publicMatrix,
	); err != nil {
		log.Fatal(err)
	}

	catalog.Version = hex.EncodeToString(
		setupDigest.Sum(nil),
	)

	_, hint := scheme.Setup(database, sharedState, params)

	hintMatrix := hint.Data[0]

	log.Printf(
		"public matrix ready: %d rows x %d columns",
		publicMatrix.Rows,
		publicMatrix.Cols,
	)

	log.Printf(
		"reusable hint ready: %d rows x %d columns",
		hintMatrix.Rows,
		hintMatrix.Cols,
	)

	//HTTP ROUTER
	mux := http.NewServeMux()

	mux.HandleFunc("/catalog", func(
		writer http.ResponseWriter,
		request *http.Request,
	) {
		if request.Method != http.MethodGet {
			http.Error(
				writer,
				"GET required",
				http.StatusMethodNotAllowed,
			)
			return
		}
		writer.Header().Set(
			"Content-Type",
			"application/json",
		)
		if err := json.NewEncoder(writer).Encode(catalog); err != nil {
			log.Print(err)
		}
	})

	// Send the public matrix A and reusable hint to the client.
	mux.HandleFunc("/setup", func(
		writer http.ResponseWriter,
		request *http.Request,
	) {
		if request.Method != http.MethodGet {
			http.Error(
				writer,
				"GET required",
				http.StatusMethodNotAllowed,
			)
			return
		}

		writer.Header().Set(
			"Content-Type",
			"application/octet-stream",
		)

		// A must be first because the client reads it first.
		if err := fullpir.WriteMatrix(
			writer,
			publicMatrix,
		); err != nil {
			log.Print(err)
			return
		}

		// The reusable hint follows A in the same binary response.
		if err := fullpir.WriteMatrix(
			writer,
			hintMatrix,
		); err != nil {
			log.Print(err)
			return
		}
	})
	//	HANDLE QUERY

	mux.HandleFunc("/query", func(
		writer http.ResponseWriter,
		request *http.Request,
	) {
		if request.Method != http.MethodPost {
			http.Error(
				writer,
				"POST required",
				http.StatusMethodNotAllowed,
			)
			return
		}
		//column count
		queryRows := params.M

		//round to multiple of 3
		if queryRows%3 != 0 {
			queryRows += 3 - queryRows%3
		}

		// Limit the body to one byte beyond the expected size so oversized
		// requests can be detected without accepting unbounded input.
		expectedQueryBytes := int(queryRows * 4)
		request.Body = http.MaxBytesReader(
			writer,
			request.Body,
			int64(expectedQueryBytes+1),
		)

		queryBytes, err := io.ReadAll(request.Body)
		if err != nil || len(queryBytes) != expectedQueryBytes {
			http.Error(writer, "invalid PIR query size", http.StatusBadRequest)
			return
		}

		queryDigest := sha256.Sum256(queryBytes)
		querySHA256 := hex.EncodeToString(queryDigest[:])
		log.Printf(
			"REMOTE SERVER received binary PIR query bytes=%d first32=%s sha256=%s",
			len(queryBytes),
			previewHex(queryBytes),
			querySHA256,
		)

		// Convert the binary query into the matrix expected by SimplePIR.
		queryMatrix, err := fullpir.ReadMatrix(
			bytes.NewReader(queryBytes),
			queryRows,
			1,
		)
		if err != nil {
			http.Error(writer, "invalid PIR query", http.StatusBadRequest)
			return
		}

		//convert matrix into simple type msg

		query := pir.MakeMsg(queryMatrix)
		queries := pir.MakeMsgSlice(query)

		answer := scheme.Answer(
			database,
			queries,
			pir.MakeState(),
			sharedState,
			params,
		)

		answerMatrix := answer.Data[0]
		var answerBody bytes.Buffer
		if err := fullpir.WriteMatrix(&answerBody, answerMatrix); err != nil {
			log.Print(err)
			return
		}
		answerBytes := answerBody.Bytes()

		log.Printf(
			"REMOTE SERVER generated encoded answer bytes=%d first32=%s",
			len(answerBytes),
			previewHex(answerBytes),
		)

		writer.Header().Set("Content-Type", "application/octet-stream")
		writer.Header().Set("X-PIR-Query-SHA256", querySHA256)
		if _, err := writer.Write(answerBytes); err != nil {
			log.Print(err)
		}
	})

	log.Printf("listening on http://%s", *address)
	//start server
	if err := http.ListenAndServe(*address, mux); err != nil {
		log.Fatal(err)
	}

}
func previewHex(data []byte) string {
	limit := 32
	if len(data) < limit {
		limit = len(data)
	}
	return hex.EncodeToString(data[:limit])
}
