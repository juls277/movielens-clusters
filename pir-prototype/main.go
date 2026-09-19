package main

import "github.com/ahenzinger/simplepir/pir"

func main() {
	scheme := pir.SimplePIR{}
	params := scheme.PickParams(4, 9, 1<<10, 32)
	database := pir.MakeDB(4, 9, &params, []uint64{17, 42, 0, 0})

	pir.RunPIR(&scheme, database, params, []uint64{1})
}
