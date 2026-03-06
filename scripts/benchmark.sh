#!/bin/bash
# TSFSYSTEM Performance Benchmarking Script
# =========================================
# Runs comprehensive performance benchmarks using Apache Bench and custom scripts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-https://localhost:8000}"
NUM_REQUESTS="${NUM_REQUESTS:-1000}"
CONCURRENCY="${CONCURRENCY:-10}"
RESULTS_DIR="benchmark_results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🚀 TSFSYSTEM Performance Benchmark${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Base URL: $BASE_URL"
echo "Requests: $NUM_REQUESTS"
echo "Concurrency: $CONCURRENCY"
echo "Results dir: $RESULTS_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"
REPORT_FILE="$RESULTS_DIR/benchmark_${TIMESTAMP}.txt"

# Check dependencies
command -v ab >/dev/null 2>&1 || {
    echo -e "${RED}Error: Apache Bench (ab) is not installed${NC}"
    echo "Install with: sudo apt install apache2-utils"
    exit 1
}

command -v curl >/dev/null 2>&1 || {
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
}

# Initialize report
{
    echo "======================================"
    echo "TSFSYSTEM Performance Benchmark Report"
    echo "======================================"
    echo ""
    echo "Date: $(date)"
    echo "Base URL: $BASE_URL"
    echo "Requests: $NUM_REQUESTS"
    echo "Concurrency: $CONCURRENCY"
    echo ""
} > "$REPORT_FILE"

# Function to run benchmark
run_benchmark() {
    local name=$1
    local url=$2
    local method=${3:-GET}

    echo -e "${YELLOW}Testing: $name${NC}"
    echo "URL: $url"

    {
        echo "======================================"
        echo "Test: $name"
        echo "======================================"
        echo "URL: $url"
        echo "Method: $method"
        echo ""
    } >> "$REPORT_FILE"

    if [ "$method" = "GET" ]; then
        ab -n "$NUM_REQUESTS" -c "$CONCURRENCY" -g "$RESULTS_DIR/${name}_${TIMESTAMP}.tsv" "$url" >> "$REPORT_FILE" 2>&1
    else
        echo "POST/PUT benchmarks require custom implementation" >> "$REPORT_FILE"
    fi

    echo "" >> "$REPORT_FILE"
    echo -e "${GREEN}✅ Complete${NC}\n"
}

# Function to extract key metrics
extract_metrics() {
    local name=$1
    local log_file="$REPORT_FILE"

    echo -e "${BLUE}📊 $name Metrics:${NC}"

    # Extract metrics from ab output
    grep "Requests per second" "$log_file" | tail -1
    grep "Time per request" "$log_file" | tail -2
    grep "Transfer rate" "$log_file" | tail -1
    echo ""
}

# Health Check
echo -e "${BLUE}1. Health Check Endpoint${NC}"
run_benchmark "health_check" "$BASE_URL/health/"

# API Endpoints (adjust URLs to match your API)
echo -e "${BLUE}2. API Endpoints${NC}"

# Products API
if curl -s -f "$BASE_URL/api/v1/products/" > /dev/null 2>&1; then
    run_benchmark "products_list" "$BASE_URL/api/v1/products/"
else
    echo -e "${YELLOW}⚠️ Products endpoint not accessible, skipping${NC}"
fi

# Invoices API
if curl -s -f "$BASE_URL/api/v1/invoices/" > /dev/null 2>&1; then
    run_benchmark "invoices_list" "$BASE_URL/api/v1/invoices/"
else
    echo -e "${YELLOW}⚠️ Invoices endpoint not accessible, skipping${NC}"
fi

# Orders API
if curl -s -f "$BASE_URL/api/v1/orders/" > /dev/null 2>&1; then
    run_benchmark "orders_list" "$BASE_URL/api/v1/orders/"
else
    echo -e "${YELLOW}⚠️ Orders endpoint not accessible, skipping${NC}"
fi

# Admin Panel
echo -e "${BLUE}3. Admin Panel${NC}"
if curl -s -f "$BASE_URL/admin/" > /dev/null 2>&1; then
    run_benchmark "admin_login" "$BASE_URL/admin/"
else
    echo -e "${YELLOW}⚠️ Admin endpoint not accessible, skipping${NC}"
fi

# Static Files
echo -e "${BLUE}4. Static Files${NC}"
if curl -s -f "$BASE_URL/static/admin/css/base.css" > /dev/null 2>&1; then
    run_benchmark "static_css" "$BASE_URL/static/admin/css/base.css"
else
    echo -e "${YELLOW}⚠️ Static files not accessible, skipping${NC}"
fi

# Generate summary
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}📊 Benchmark Summary${NC}"
echo -e "${BLUE}============================================${NC}"

{
    echo ""
    echo "======================================"
    echo "SUMMARY"
    echo "======================================"
    echo ""
    echo "Tests completed at: $(date)"
    echo ""
    echo "Key Findings:"
    echo "-------------"
} >> "$REPORT_FILE"

# Extract and display summary metrics
echo ""
grep -A 3 "Test: health_check" "$REPORT_FILE" | grep "Requests per second" || true
grep -A 3 "Test: products_list" "$REPORT_FILE" | grep "Requests per second" || true
grep -A 3 "Test: invoices_list" "$REPORT_FILE" | grep "Requests per second" || true

echo ""
echo -e "${GREEN}✅ Benchmark complete!${NC}"
echo -e "Full report: ${BLUE}$REPORT_FILE${NC}"
echo ""

# Check for performance issues
echo -e "${BLUE}Analyzing results...${NC}"

SLOW_REQUESTS=$(grep "Time per request" "$REPORT_FILE" | grep -v "across all" | awk '{print $4}' | awk '$1 > 500 {print}' | wc -l)

if [ "$SLOW_REQUESTS" -gt 0 ]; then
    echo -e "${RED}⚠️ Warning: $SLOW_REQUESTS endpoint(s) exceeded 500ms response time${NC}"
    {
        echo ""
        echo "Performance Warnings:"
        echo "--------------------"
        echo "- $SLOW_REQUESTS endpoint(s) exceeded 500ms"
        echo "- Review slow queries in database"
        echo "- Consider adding caching"
        echo "- Check server resources"
    } >> "$REPORT_FILE"
else
    echo -e "${GREEN}✅ All endpoints meet performance targets (<500ms)${NC}"
    {
        echo ""
        echo "All endpoints meet performance targets (<500ms)"
    } >> "$REPORT_FILE"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Benchmark Results Location${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Report: ${GREEN}$REPORT_FILE${NC}"
echo -e "TSV data: ${GREEN}$RESULTS_DIR/*_${TIMESTAMP}.tsv${NC}"
echo ""

# Optional: Generate graphs (requires gnuplot)
if command -v gnuplot >/dev/null 2>&1; then
    echo -e "${YELLOW}Generating graphs...${NC}"

    for tsv_file in "$RESULTS_DIR"/*_${TIMESTAMP}.tsv; do
        if [ -f "$tsv_file" ]; then
            name=$(basename "$tsv_file" .tsv)
            gnuplot <<-EOF
				set terminal png size 800,600
				set output "$RESULTS_DIR/${name}.png"
				set title "Response Time Distribution - $name"
				set xlabel "Request"
				set ylabel "Response Time (ms)"
				set datafile separator "\t"
				plot "$tsv_file" using 5 with lines title "Response Time"
			EOF
            echo -e "${GREEN}✅ Graph: $RESULTS_DIR/${name}.png${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️ gnuplot not installed, skipping graph generation${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Benchmarking complete!${NC}"
