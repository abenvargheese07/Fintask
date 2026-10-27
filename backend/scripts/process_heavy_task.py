import sys
import json

def process_data(payload: dict) -> dict:
    # ---------------------------------------------------------
    # Place your heavy processing logic here:
    # (e.g. database calculations, batch transformations, 
    #  financial forecasting, file generation, analytics)
    # ---------------------------------------------------------
    raw_values = payload.get("values", [])
    
    # Example compute task:
    computed_sum = sum(float(x) ** 2 for x in raw_values)
    
    return {
        "status": "success",
        "processed_count": len(raw_values),
        "result": computed_sum
    }

def main():
    try:
        # 1. Read input JSON string from the first argument (or fallback to stdin)
        if len(sys.argv) > 1:
            input_raw = sys.argv[1]
        else:
            input_raw = sys.stdin.read().strip()
            
        payload = json.loads(input_raw) if input_raw else {}

        # 2. Run the heavy computation
        output = process_data(payload)

        # 3. Print STRICTLY valid JSON to stdout
        print(json.dumps(output))

    except Exception as e:
        error_payload = {
            "status": "error",
            "message": str(e)
        }
        print(json.dumps(error_payload), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()