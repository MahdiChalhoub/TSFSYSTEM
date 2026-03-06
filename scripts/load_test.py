#!/usr/bin/env python3
"""
TSFSYSTEM Load Testing Script
==============================
Advanced load testing using Python with detailed metrics and reporting.

Requirements:
    pip install requests locust

Usage:
    # Quick test
    python scripts/load_test.py

    # Custom configuration
    python scripts/load_test.py --url https://production.com --users 100 --duration 300

    # Using Locust
    locust -f scripts/load_test.py --host=https://production.com
"""

import argparse
import json
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import List, Dict, Tuple

import requests
from requests.exceptions import RequestException


class LoadTester:
    """Simple load tester for TSFSYSTEM"""

    def __init__(self, base_url: str, num_users: int = 10, duration: int = 60):
        self.base_url = base_url.rstrip('/')
        self.num_users = num_users
        self.duration = duration
        self.results: List[Dict] = []
        self.errors: List[Dict] = []

    def make_request(self, endpoint: str, method: str = 'GET', **kwargs) -> Tuple[float, int, str]:
        """
        Make HTTP request and return (duration_ms, status_code, error)
        """
        url = f"{self.base_url}{endpoint}"
        start = time.perf_counter()

        try:
            if method == 'GET':
                response = requests.get(url, timeout=30, **kwargs)
            elif method == 'POST':
                response = requests.post(url, timeout=30, **kwargs)
            else:
                raise ValueError(f"Unsupported method: {method}")

            end = time.perf_counter()
            duration_ms = (end - start) * 1000

            return duration_ms, response.status_code, None

        except RequestException as e:
            end = time.perf_counter()
            duration_ms = (end - start) * 1000
            return duration_ms, 0, str(e)

    def worker(self, worker_id: int, endpoints: List[str]) -> Dict:
        """
        Simulate a single user making requests
        """
        start_time = time.time()
        requests_made = 0
        worker_results = []

        while (time.time() - start_time) < self.duration:
            for endpoint in endpoints:
                duration_ms, status_code, error = self.make_request(endpoint)

                result = {
                    'worker_id': worker_id,
                    'endpoint': endpoint,
                    'duration_ms': duration_ms,
                    'status_code': status_code,
                    'error': error,
                    'timestamp': datetime.now().isoformat()
                }

                worker_results.append(result)

                if error or status_code >= 400:
                    self.errors.append(result)

                requests_made += 1

            # Small delay between cycles
            time.sleep(0.1)

        return {
            'worker_id': worker_id,
            'requests_made': requests_made,
            'results': worker_results
        }

    def run_load_test(self, endpoints: List[str]):
        """
        Run load test with multiple concurrent users
        """
        print(f"\n{'='*70}")
        print(f"🚀 Starting Load Test")
        print(f"{'='*70}")
        print(f"Base URL: {self.base_url}")
        print(f"Concurrent Users: {self.num_users}")
        print(f"Duration: {self.duration}s")
        print(f"Endpoints: {len(endpoints)}")
        print(f"{'='*70}\n")

        start_time = time.time()

        # Run workers concurrently
        with ThreadPoolExecutor(max_workers=self.num_users) as executor:
            futures = [
                executor.submit(self.worker, i, endpoints)
                for i in range(self.num_users)
            ]

            # Collect results
            for future in as_completed(futures):
                worker_result = future.result()
                self.results.extend(worker_result['results'])
                print(f"✅ Worker {worker_result['worker_id']} completed: "
                      f"{worker_result['requests_made']} requests")

        end_time = time.time()
        total_duration = end_time - start_time

        print(f"\n✅ Load test completed in {total_duration:.2f}s\n")

        return self.analyze_results(total_duration)

    def analyze_results(self, total_duration: float) -> Dict:
        """
        Analyze results and generate report
        """
        if not self.results:
            print("❌ No results to analyze")
            return {}

        # Group by endpoint
        endpoint_stats = {}

        for result in self.results:
            endpoint = result['endpoint']
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = {
                    'durations': [],
                    'status_codes': [],
                    'errors': 0
                }

            endpoint_stats[endpoint]['durations'].append(result['duration_ms'])
            endpoint_stats[endpoint]['status_codes'].append(result['status_code'])

            if result['error'] or result['status_code'] >= 400:
                endpoint_stats[endpoint]['errors'] += 1

        # Calculate statistics
        report = {
            'summary': {
                'total_requests': len(self.results),
                'total_errors': len(self.errors),
                'error_rate': len(self.errors) / len(self.results) * 100,
                'duration_seconds': total_duration,
                'requests_per_second': len(self.results) / total_duration,
                'concurrent_users': self.num_users
            },
            'endpoints': {}
        }

        for endpoint, stats in endpoint_stats.items():
            durations = stats['durations']

            report['endpoints'][endpoint] = {
                'total_requests': len(durations),
                'errors': stats['errors'],
                'error_rate': stats['errors'] / len(durations) * 100,
                'min_ms': min(durations),
                'max_ms': max(durations),
                'mean_ms': statistics.mean(durations),
                'median_ms': statistics.median(durations),
                'p95_ms': self.percentile(durations, 95),
                'p99_ms': self.percentile(durations, 99),
                'status_codes': self.count_status_codes(stats['status_codes'])
            }

        return report

    @staticmethod
    def percentile(data: List[float], percentile: int) -> float:
        """Calculate percentile"""
        size = len(data)
        if size == 0:
            return 0
        sorted_data = sorted(data)
        index = int(size * percentile / 100)
        return sorted_data[min(index, size - 1)]

    @staticmethod
    def count_status_codes(codes: List[int]) -> Dict[str, int]:
        """Count status codes"""
        counts = {}
        for code in codes:
            key = str(code)
            counts[key] = counts.get(key, 0) + 1
        return counts

    def print_report(self, report: Dict):
        """
        Print formatted report
        """
        print(f"\n{'='*70}")
        print("📊 LOAD TEST REPORT")
        print(f"{'='*70}\n")

        # Summary
        summary = report['summary']
        print("Summary")
        print("-" * 70)
        print(f"Total Requests:       {summary['total_requests']:,}")
        print(f"Total Errors:         {summary['total_errors']:,}")
        print(f"Error Rate:           {summary['error_rate']:.2f}%")
        print(f"Duration:             {summary['duration_seconds']:.2f}s")
        print(f"Requests/Second:      {summary['requests_per_second']:.2f}")
        print(f"Concurrent Users:     {summary['concurrent_users']}")
        print()

        # Endpoint details
        print("Endpoint Performance")
        print("-" * 70)

        for endpoint, stats in report['endpoints'].items():
            print(f"\n{endpoint}")
            print(f"  Requests:     {stats['total_requests']:,}")
            print(f"  Errors:       {stats['errors']} ({stats['error_rate']:.2f}%)")
            print(f"  Min:          {stats['min_ms']:.2f}ms")
            print(f"  Mean:         {stats['mean_ms']:.2f}ms")
            print(f"  Median:       {stats['median_ms']:.2f}ms")
            print(f"  P95:          {stats['p95_ms']:.2f}ms")
            print(f"  P99:          {stats['p99_ms']:.2f}ms")
            print(f"  Max:          {stats['max_ms']:.2f}ms")

            if stats['status_codes']:
                codes_str = ', '.join([f"{code}: {count}" for code, count in stats['status_codes'].items()])
                print(f"  Status Codes: {codes_str}")

        # Performance assessment
        print(f"\n{'='*70}")
        print("Performance Assessment")
        print("-" * 70)

        issues = []
        warnings = []

        if summary['error_rate'] > 5:
            issues.append(f"❌ High error rate: {summary['error_rate']:.2f}%")
        elif summary['error_rate'] > 1:
            warnings.append(f"⚠️ Elevated error rate: {summary['error_rate']:.2f}%")

        for endpoint, stats in report['endpoints'].items():
            if stats['p95_ms'] > 1000:
                issues.append(f"❌ {endpoint}: P95 response time > 1s ({stats['p95_ms']:.2f}ms)")
            elif stats['p95_ms'] > 500:
                warnings.append(f"⚠️ {endpoint}: P95 response time > 500ms ({stats['p95_ms']:.2f}ms)")

        if summary['requests_per_second'] < 10:
            warnings.append(f"⚠️ Low throughput: {summary['requests_per_second']:.2f} req/s")

        if not issues and not warnings:
            print("✅ All performance metrics within acceptable range")
        else:
            if issues:
                print("\nIssues:")
                for issue in issues:
                    print(f"  {issue}")

            if warnings:
                print("\nWarnings:")
                for warning in warnings:
                    print(f"  {warning}")

        print(f"\n{'='*70}\n")

    def save_report(self, report: Dict, filename: str):
        """
        Save report to JSON file
        """
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"📄 Report saved to: {filename}")


# Locust Integration (optional)
try:
    from locust import HttpUser, task, between

    class TSFSystemUser(HttpUser):
        """
        Locust user for load testing TSFSYSTEM

        Usage:
            locust -f scripts/load_test.py --host=https://yourdomain.com
        """
        wait_time = between(1, 3)

        @task(3)
        def view_products(self):
            """View products list"""
            self.client.get("/api/v1/products/")

        @task(2)
        def view_invoices(self):
            """View invoices list"""
            self.client.get("/api/v1/invoices/")

        @task(2)
        def view_orders(self):
            """View orders list"""
            self.client.get("/api/v1/orders/")

        @task(1)
        def health_check(self):
            """Health check"""
            self.client.get("/health/")

except ImportError:
    print("⚠️ Locust not installed. Install with: pip install locust")


def main():
    parser = argparse.ArgumentParser(description='TSFSYSTEM Load Testing')
    parser.add_argument('--url', default='http://localhost:8000', help='Base URL')
    parser.add_argument('--users', type=int, default=10, help='Number of concurrent users')
    parser.add_argument('--duration', type=int, default=60, help='Test duration in seconds')
    parser.add_argument('--output', default='load_test_report.json', help='Output file')

    args = parser.parse_args()

    # Define endpoints to test
    endpoints = [
        '/health/',
        '/api/v1/products/',
        '/api/v1/invoices/',
        '/api/v1/orders/',
    ]

    # Run load test
    tester = LoadTester(
        base_url=args.url,
        num_users=args.users,
        duration=args.duration
    )

    report = tester.run_load_test(endpoints)
    tester.print_report(report)
    tester.save_report(report, args.output)

    # Exit with error code if there are issues
    if report['summary']['error_rate'] > 5:
        print("\n❌ Load test failed: Error rate > 5%")
        exit(1)

    print("\n✅ Load test completed successfully")
    exit(0)


if __name__ == '__main__':
    main()
