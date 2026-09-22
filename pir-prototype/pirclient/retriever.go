package pirclient

import (
	"encoding/json"
	"fmt"
	"movielens-clusters/pir-prototype/fullpir"
	"net/http"
	"strings"
	"time"
)

type Retriever struct {
	serverURL string
	cacheDir  string
	client    *http.Client
}

func New(serverURL string, cacheDir string) *Retriever {
	serverURL = strings.TrimRight(serverURL, "/")

	return &Retriever{
		serverURL: serverURL,
		cacheDir:  cacheDir,
		client: &http.Client{
			Timeout: 5 * time.Minute,
		},
	}
}

func (retriever *Retriever) Catalog() (fullpir.Catalog, error) {
	url := retriever.serverURL + "/catalog"

	response, err := retriever.client.Get(url)
	if err != nil {
		return fullpir.Catalog{}, fmt.Errorf(
			"download catalog: %w",
			err,
		)
	}

	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fullpir.Catalog{}, fmt.Errorf(
			"catalog request returned %s",
			response.Status,
		)
	}

	var catalog fullpir.Catalog

	if err := json.NewDecoder(response.Body).Decode(
		&catalog,
	); err != nil {
		return fullpir.Catalog{}, fmt.Errorf(
			"decode catalog: %w",
			err,
		)
	}

	if len(catalog.Names) < 2 {
		return fullpir.Catalog{}, fmt.Errorf(
			"catalog contains fewer than two clusters",
		)
	}

	if catalog.RecordSize < 4 {
		return fullpir.Catalog{}, fmt.Errorf(
			"catalog has invalid record size",
		)
	}
	if catalog.Version == "" {
		return fullpir.Catalog{}, fmt.Errorf(
			"catalog has no version",
		)
	}
	return catalog, nil
}

func clusterIndex(catalog fullpir.Catalog, clusterName string) (uint64, error) {
	for index, name := range catalog.Names {
		if name == clusterName {
			return uint64(index), nil
		}
	}
	return 0, fmt.Errorf(
		"cluster %q is not in the catalog",
		clusterName,
	)
}
