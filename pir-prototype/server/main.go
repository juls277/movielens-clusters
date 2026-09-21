package main

import (
	"flag"
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
	log.Printf("listening on http://%s", *address)
	//start server
	if err := http.ListenAndServe(*address, mux); err != nil {
		log.Fatal(err)
	}

}
