package main

import (
	"flag"
	"fmt"
	"log"

	"movielens-clusters/pir-prototype/pirclient"
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

	retriever := pirclient.New(*serverURL, *cacheDir)

	if *listOnly {
		catalog, err := retriever.Catalog()
		if err != nil {
			log.Fatal(err)
		}

		for _, name := range catalog.Names {
			fmt.Println(name)
		}
		return
	}

	if *clusterName == "" {
		log.Fatal("use -cluster with a name from -list")
	}

	movies, err := retriever.Retrieve(*clusterName)
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
