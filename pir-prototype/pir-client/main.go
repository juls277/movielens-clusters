package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"movielens-clusters/pir-prototype/pirclient"
)

func main() {
	pirServerURL := flag.String(
		"pir-server",
		"http://127.0.0.1:3001",
		"PIR server URL",
	)
	address := flag.String(
		"listen",
		"127.0.0.1:3002",
		"local PIR client address",
	)
	cacheDir := flag.String(
		"cache-dir",
		".pir-cache",
		"directory for the reusable PIR setup",
	)
	uiDir := flag.String(
		"ui-dir",
		"../src/client",
		"directory containing the browser UI",
	)
	flag.Parse()

	retriever := pirclient.New(*pirServerURL, *cacheDir)
	var retrievalMu sync.Mutex

	mux := http.NewServeMux()
	mux.HandleFunc("/cluster/", func(writer http.ResponseWriter, request *http.Request) {

		if request.Method != http.MethodGet {
			http.Error(writer, "GET required", http.StatusMethodNotAllowed)
			return
		}

		path := strings.TrimPrefix(request.URL.Path, "/cluster/")
		parts := strings.SplitN(path, "/", 2)
		if len(parts) != 2 || parts[1] == "" {
			http.Error(writer, "use /cluster/single/name or /cluster/pair/name", http.StatusBadRequest)
			return
		}

		var catalogPrefix string
		switch parts[0] {
		case "single":
			catalogPrefix = "single/"
		case "pair":
			catalogPrefix = "pairs/"
		default:
			http.Error(writer, "cluster type must be single or pair", http.StatusBadRequest)
			return
		}

		clusterName := catalogPrefix + parts[1]

		retrievalMu.Lock()
		movies, audit, err := retriever.RetrieveWithAudit(clusterName)
		retrievalMu.Unlock()
		if err != nil {
			log.Printf("retrieve %s: %v", clusterName, err)
			http.Error(writer, "private cluster retrieval failed", http.StatusBadGateway)
			return
		}

		writer.Header().Set("X-PIR-Protocol", audit.Protocol)
		writer.Header().Set("X-PIR-Query-Bytes", strconv.Itoa(audit.QueryBytes))
		writer.Header().Set("X-PIR-Answer-Bytes", strconv.Itoa(audit.AnswerBytes))
		writer.Header().Set("X-PIR-Query-SHA256", audit.QuerySHA256)
		writer.Header().Set("X-PIR-Server-Confirmed", strconv.FormatBool(audit.ServerConfirmed))
		writer.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(writer).Encode(movies); err != nil {
			log.Printf("encode %s: %v", clusterName, err)
		}
	})

	mux.Handle("/", http.FileServer(http.Dir(*uiDir)))

	log.Printf("serving browser UI from %s", *uiDir)
	log.Printf("local PIR client listening on http://%s", *address)
	if err := http.ListenAndServe(*address, mux); err != nil {
		log.Fatal(err)
	}
}
