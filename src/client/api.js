export async function getCluster(type, clusterName) {

  
  // work correctly inside the URL
  const encodedName = encodeURIComponent(clusterName);

  const url =
    `/cluster/${type}/${encodedName}`;

  // Send HTTP request
  const response = await fetch(url);

  // Check whether server returned an error
  if (!response.ok) {
    throw new Error(
      `Server returned ${response.status}: ${response.statusText}`
    );
  }

  const privacyAudit = {
    selectedLocally: `${type}/${clusterName}`,
    protocol: response.headers.get("X-PIR-Protocol"),
    remoteQueryBytes: Number(response.headers.get("X-PIR-Query-Bytes")),
    remoteAnswerBytes: Number(response.headers.get("X-PIR-Answer-Bytes")),
    querySHA256: response.headers.get("X-PIR-Query-SHA256"),
    serverConfirmedQuery: response.headers.get("X-PIR-Server-Confirmed") === "true"
  };

  console.group("PIR privacy audit");
  console.log("Selection known to local client:", privacyAudit.selectedLocally);
  console.log("Remote server received:", `${privacyAudit.remoteQueryBytes} binary ${privacyAudit.protocol} query bytes`);
  console.log("Remote server returned:", `${privacyAudit.remoteAnswerBytes} encoded answer bytes`);
  console.log("Query SHA-256:", privacyAudit.querySHA256);
  console.log("Server confirmed exact query:", privacyAudit.serverConfirmedQuery);
  console.log("Cluster name sent to remote PIR server: no");
  console.groupEnd();
  // Convert received JSON into JavaScript objects
  const movies = await response.json();

  return movies;
}

export async function fetchClusters(clusterNames){
  const requests = clusterNames.map((cluster) => {

    const type = cluster.includes("+")
      ? "pair"
      : "single";

    return getCluster(type, cluster);
  });
const results = await Promise.all(requests);

return results;
}
