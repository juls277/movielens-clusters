const { loadCleanMovies } = require("./preprocessing");



function createPairKey(genre1, genre2) {
  return [genre1, genre2]
    .sort()
    .join("+");
}


//serialized json in bytes

function getSizeInBytes(data) {
  const json = JSON.stringify(data);

  return Buffer.byteLength(
    json,
    "utf8"
  );
}


//readable byte size

function formatBytes(bytes) {

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}


//create clusters

async function createClusters() {

  const movies = await loadCleanMovies();

  console.log(
    "Clean movies loaded:",
    movies.length
  );

  // Movies that have exactly one genre
  const singleClusters = {};

  // Movies grouped by every genre pair they contain
  const pairClusters = {};


  // ------------------------------------------------
  // Process every movie
  // ------------------------------------------------

  for (const movie of movies) {

    const genres = movie.genres;


   

    if (genres.length === 1) {

      const genre = genres[0];

      if (!singleClusters[genre]) {
        singleClusters[genre] = [];
      }

      singleClusters[genre].push(movie);

      continue;
    }


    

    for (let i = 0; i < genres.length; i++) {

      for (
        let j = i + 1;
        j < genres.length;
        j++
      ) {

        const genre1 = genres[i];
        const genre2 = genres[j];

        const pairKey = createPairKey(
          genre1,
          genre2
        );

        if (!pairClusters[pairKey]) {
          pairClusters[pairKey] = [];
        }

        pairClusters[pairKey].push(
          movie
        );
      }
    }
  }


  return {
    movies,
    singleClusters,
    pairClusters,
    totalMovies: movies.length
  };
}


//main
async function main() {

  const {
    movies,
    singleClusters,
    pairClusters,
    totalMovies
  } = await createClusters();


  //original 20 before partitioning
  const originalGenreCounts = {};


  for (const movie of movies) {

    for (const genre of movie.genres) {

      if (!originalGenreCounts[genre]) {
        originalGenreCounts[genre] = 0;
      }

      originalGenreCounts[genre]++;
    }
  }


  const originalGenreSizes =
    Object.entries(
      originalGenreCounts
    )
      .sort(
        (a, b) => b[1] - a[1]
      );


  console.log(
    "\n=============================="
  );
  console.log(
    "ORIGINAL GENRE CLUSTER SIZES"
  );
  console.log(
    "BEFORE PAIRWISE PARTITIONING"
  );
  console.log(
    "==============================\n"
  );


  for (
    const [genre, count]
    of originalGenreSizes
  ) {

    console.log(
      `${genre}: ${count} movies`
    );
  }


  console.log(
    "\nNumber of original genres:",
    originalGenreSizes.length
  );


 //single clusters

  console.log(
    "\n=============================="
  );
  console.log(
    "SINGLE-GENRE CLUSTERS"
  );
  console.log(
    "==============================\n"
  );


  const singleNames =
    Object.keys(
      singleClusters
    ).sort();


  for (const genre of singleNames) {

    console.log(
      `${genre}: ${
        singleClusters[genre].length
      } movies`
    );
  }


  console.log(
    "\nNumber of non-empty single clusters:",
    singleNames.length
  );


 //pair clusters

  console.log(
    "\n=============================="
  );
  console.log(
    "PAIR CLUSTERS"
  );
  console.log(
    "==============================\n"
  );


  const pairNames =
    Object.keys(
      pairClusters
    ).sort();


  for (const pair of pairNames) {

    console.log(
      `${pair}: ${
        pairClusters[pair].length
      } movies`
    );
  }


  console.log(
    "\nNumber of non-empty pair clusters:",
    pairNames.length
  );


 //all 210
  const allClusters = [];


 //singe clusters

  for (const genre of singleNames) {

    const data =
      singleClusters[genre];

    allClusters.push({
      name: genre,
      type: "single",
      size: data.length,

      // Serialized JSON size
      bytes: getSizeInBytes(data)
    });
  }


 //pair clusters

  for (const pair of pairNames) {

    const data =
      pairClusters[pair];

    allClusters.push({
      name: pair,
      type: "pair",
      size: data.length,

      // Serialized JSON size
      bytes: getSizeInBytes(data)
    });
  }


  //sort by bytes size

  allClusters.sort(
    (a, b) =>
      b.bytes - a.bytes
  );


  console.log(
    "\n=============================="
  );
  console.log(
    "ALL CLUSTERS"
  );
  console.log(
    "BIGGEST -> SMALLEST BY BYTES"
  );
  console.log(
    "==============================\n"
  );


  for (
    const cluster
    of allClusters
  ) {

    console.log(
      `${cluster.name}: ` +
      `${cluster.size} movies — ` +
      `${formatBytes(cluster.bytes)}`
    );
  }


  //total stored entries

  let singleEntries = 0;


  for (const genre of singleNames) {

    singleEntries +=
      singleClusters[
        genre
      ].length;
  }


  let pairEntries = 0;


  for (const pair of pairNames) {

    pairEntries +=
      pairClusters[
        pair
      ].length;
  }


  const totalClusterEntries =
    singleEntries +
    pairEntries;


  //duplication

  const duplicationFactor =
    totalClusterEntries /
    totalMovies;


  //total size

  const totalClusterBytes =
    allClusters.reduce(
      (sum, cluster) =>
        sum + cluster.bytes,
      0
    );


 

  console.log(
    "\n=============================="
  );
  console.log(
    "SUMMARY"
  );
  console.log(
    "==============================\n"
  );


  console.log(
    "Unique movies:",
    totalMovies
  );


  console.log(
    "Original genre clusters:",
    originalGenreSizes.length
  );


  console.log(
    "Single-genre clusters:",
    singleNames.length
  );


  console.log(
    "Pair clusters:",
    pairNames.length
  );


  console.log(
    "Total semantic clusters:",
    singleNames.length +
    pairNames.length
  );


  console.log(
    "Single-genre cluster entries:",
    singleEntries
  );


  console.log(
    "Pair-cluster entries:",
    pairEntries
  );


  console.log(
    "Total cluster entries:",
    totalClusterEntries
  );


  console.log(
    "Duplication factor:",
    duplicationFactor.toFixed(2)
  );


  console.log(
    "Total serialized cluster storage:",
    formatBytes(
      totalClusterBytes
    )
  );


  //biggest->smallest

  const biggestCluster =
    allClusters[0];

  const smallestCluster =
    allClusters[
      allClusters.length - 1
    ];


  console.log(
    "\n=============================="
  );
  console.log(
    "CLUSTER SIZE RANGE"
  );
  console.log(
    "==============================\n"
  );


  console.log(
    "Biggest cluster:",
    biggestCluster.name,
    "-",
    biggestCluster.size,
    "movies",
    "-",
    formatBytes(
      biggestCluster.bytes
    )
  );


  console.log(
    "Smallest cluster:",
    smallestCluster.name,
    "-",
    smallestCluster.size,
    "movies",
    "-",
    formatBytes(
      smallestCluster.bytes
    )
  );
}




main().catch((error) => {

  console.error(
    "Clustering failed:",
    error
  );

});