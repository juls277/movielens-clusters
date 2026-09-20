package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { // Run this function when someone requests /health.
		fmt.Fprintln(w, "PIR server running")
	})

	if err := http.ListenAndServe("127.0.0.1:3001", nil); err != nil { // Start listening on port 3001; enter this block only if it fails.
		panic(err)
	}
}
