package main

import (
	"fmt"
	"path/filepath"
)

func main() {
	singleFiles, err := filepath.Glob("../data/processed/single/*.json")
	if err != nil {
		panic(err)
	}

	pairFiles, err := filepath.Glob("../data/processed/pairs/*.json")
	if err != nil {
		panic(err)
	}

	total := len(singleFiles) + len(pairFiles)

	fmt.Println("Single clusters:", len(singleFiles))
	fmt.Println("Pair clusters:", len(pairFiles))
	fmt.Println("Total clusters:", total)
}
