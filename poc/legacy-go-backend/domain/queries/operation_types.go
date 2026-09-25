package queries

type OperationType string

const (
	Equals        OperationType = "eq"
	NotEquals     OperationType = "neq"
	GreaterThan   OperationType = "gt"
	LessThan      OperationType = "lt"
	GreaterEquals OperationType = "gte"
	LessEquals    OperationType = "lte"
	In            OperationType = "in"
	NotIn         OperationType = "nin"
	Contains      OperationType = "contains"
)

var NumericOperations = map[OperationType]bool{
	GreaterThan:   true,
	LessThan:      true,
	GreaterEquals: true,
	LessEquals:    true,
}

type Operation struct {
	Type OperationType
	SQL  string
}

var Operations = map[OperationType]Operation{
	Equals:        {Type: Equals, SQL: "="},
	NotEquals:     {Type: NotEquals, SQL: "!="},
	GreaterThan:   {Type: GreaterThan, SQL: ">"},
	LessThan:      {Type: LessThan, SQL: "<"},
	GreaterEquals: {Type: GreaterEquals, SQL: ">="},
	LessEquals:    {Type: LessEquals, SQL: "<="},
	In:            {Type: In, SQL: "IN"},
	NotIn:         {Type: NotIn, SQL: "NOT IN"},
	Contains:      {Type: Contains, SQL: "LIKE"},
}

func GetOperation(opType OperationType) (Operation, bool) {
	op, exists := Operations[opType]
	return op, exists
}

func isNumericOperation(op OperationType) bool {
	isNumeric, exists := NumericOperations[op]
	return exists && isNumeric
}
