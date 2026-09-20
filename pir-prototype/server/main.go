package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/ahenzinger/simplepir/pir"
)

func main() {
	//read the file into a byte slice data
	data, err := os.ReadFile("two-clusters.bin")

	if err != nil {
		panic(err)
	}

	fmt.Printf("Loaded %d cluster bytes\n", len(data))

	const byteCount = 16
	recordSize := len(data) / 2

	if len(data)%2 != 0 || recordSize < 4+byteCount {
		panic("invalid cluster file ")
	}

	scheme := pir.SimplePIR{}
	params := scheme.PickParams(4, 9, 1<<10, 32)

	parts := make([]*pir.Database, byteCount)

	for offset := range parts { // Visit byte positions 0 through 15.
		values := []uint64{ // Supply four values to this small PIR database.
			uint64(data[4+offset]),            // Position 0: this Action data byte.
			uint64(data[recordSize+4+offset]), // Position 1: this Comedy data byte.
			0,                                 // Position 2: unused.
			0,                                 // Position 3: unused.
		}
		parts[offset] = pir.MakeDB(4, 9, &params, values) // Build the database for this byte position.
	}

	//stack them so one query can retrieve
	combined := scheme.ConcatDBs(parts, &params)
	fmt.Println("PIR database ready; stored positions:", combined.Info.Num)

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { // Run this function when someone requests /health.
		fmt.Fprintln(w, "PIR server running")
	})

	if err := http.ListenAndServe("127.0.0.1:3001", nil); err != nil { // Start listening on port 3001; enter this block only if it fails.
		panic(err)
	}
}
