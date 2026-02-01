import requests
import sys
import json
from datetime import datetime

class TurkishSpeechTherapyAPITester:
    def __init__(self, base_url="https://speechtherapy-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    response_data = response.json()
                    details += f", Response: {json.dumps(response_data, indent=2)[:200]}..."
                    self.log_test(name, True, details)
                    return True, response_data
                except:
                    self.log_test(name, True, details)
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Error: {response.text[:200]}"
                self.log_test(name, False, details)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        self.run_test("Root Endpoint", "GET", "", 200)
        
        # Test health check
        self.run_test("Health Check", "GET", "health", 200)

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n🔐 Testing Authentication Flow...")
        
        # Generate unique test user
        timestamp = datetime.now().strftime("%H%M%S")
        test_email = f"test_user_{timestamp}@example.com"
        test_password = "TestPass123!"
        
        # Test user registration
        register_data = {
            "name": f"Test Çocuk {timestamp}",
            "email": test_email,
            "password": test_password,
            "age": 7,
            "parent_name": "Test Ebeveyn"
        }
        
        success, response = self.run_test(
            "User Registration", 
            "POST", 
            "auth/register", 
            200, 
            register_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"    ✅ Registered user: {response['user']['name']}")
        else:
            print("    ❌ Registration failed - cannot continue with auth tests")
            return False

        # Test getting current user info
        self.run_test("Get Current User", "GET", "auth/me", 200)
        
        # Test login with same credentials
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        success, login_response = self.run_test(
            "User Login", 
            "POST", 
            "auth/login", 
            200, 
            login_data
        )
        
        if success and 'access_token' in login_response:
            print(f"    ✅ Login successful for: {login_response['user']['name']}")
        
        return True

    def test_exercise_endpoints(self):
        """Test exercise-related endpoints"""
        print("\n📚 Testing Exercise Endpoints...")
        
        if not self.token:
            print("    ❌ No auth token - skipping exercise tests")
            return
        
        # Test get all exercises
        self.run_test("Get All Exercises", "GET", "exercises", 200)
        
        # Test get exercises by difficulty
        for difficulty in ["easy", "medium", "hard"]:
            self.run_test(
                f"Get {difficulty.title()} Exercises", 
                "GET", 
                f"exercises?difficulty={difficulty}", 
                200
            )
        
        # Test get exercises by category
        categories = ["animals", "colors", "objects", "foods", "body_parts", "phrases"]
        for category in categories:
            self.run_test(
                f"Get {category.title()} Exercises", 
                "GET", 
                f"exercises?category={category}", 
                200
            )
        
        # Test get specific exercise (using ID 1)
        self.run_test("Get Specific Exercise", "GET", "exercises/1", 200)
        
        # Test get categories
        self.run_test("Get Categories", "GET", "categories", 200)
        
        # Test get difficulties
        self.run_test("Get Difficulties", "GET", "difficulties", 200)

    def test_pronunciation_check_endpoint(self):
        """Test the new pronunciation check functionality"""
        print("\n🎤 Testing Pronunciation Check Endpoint...")
        
        if not self.token:
            print("    ❌ No auth token - skipping pronunciation tests")
            return
        
        # Test 1: Exact match should return 'dogru'
        exact_match_data = {
            "target_word": "kedi",
            "spoken_word": "kedi",
            "word_id": "1"
        }
        success, response = self.run_test(
            "Pronunciation Check - Exact Match", 
            "POST", 
            "pronunciation-check", 
            200, 
            exact_match_data
        )
        if success and response.get('result') == 'dogru':
            self.log_test("Exact match returns 'dogru'", True, f"Result: {response.get('result')}")
        else:
            self.log_test("Exact match returns 'dogru'", False, f"Expected 'dogru', got: {response.get('result')}")
        
        # Test 2: Different first letter should NEVER return 'dogru' (kedi->tedi)
        different_first_letter_data = {
            "target_word": "kedi",
            "spoken_word": "tedi",
            "word_id": "1"
        }
        success, response = self.run_test(
            "Pronunciation Check - Different First Letter", 
            "POST", 
            "pronunciation-check", 
            200, 
            different_first_letter_data
        )
        if success and response.get('result') != 'dogru':
            self.log_test("Different first letter NEVER returns 'dogru'", True, f"Result: {response.get('result')}")
        else:
            self.log_test("Different first letter NEVER returns 'dogru'", False, f"Expected NOT 'dogru', got: {response.get('result')}")
        
        # Test 3: Close match should return 'yakin' with feedback
        close_match_data = {
            "target_word": "kedi",
            "spoken_word": "keti",
            "word_id": "1"
        }
        success, response = self.run_test(
            "Pronunciation Check - Close Match", 
            "POST", 
            "pronunciation-check", 
            200, 
            close_match_data
        )
        if success and response.get('result') == 'yakin' and response.get('feedback'):
            self.log_test("Close match returns 'yakin' with feedback", True, f"Result: {response.get('result')}, Feedback: {response.get('feedback')}")
        else:
            self.log_test("Close match returns 'yakin' with feedback", False, f"Expected 'yakin' with feedback, got: {response.get('result')}, feedback: {response.get('feedback')}")
        
        # Test 4: Very different should return 'yanlis'
        very_different_data = {
            "target_word": "kedi",
            "spoken_word": "araba",
            "word_id": "1"
        }
        success, response = self.run_test(
            "Pronunciation Check - Very Different", 
            "POST", 
            "pronunciation-check", 
            200, 
            very_different_data
        )
        if success and response.get('result') == 'yanlis':
            self.log_test("Very different returns 'yanlis'", True, f"Result: {response.get('result')}")
        else:
            self.log_test("Very different returns 'yanlis'", False, f"Expected 'yanlis', got: {response.get('result')}")
        
        # Test 5: Case insensitive matching
        case_test_data = {
            "target_word": "KEDI",
            "spoken_word": "kedi",
            "word_id": "1"
        }
        success, response = self.run_test(
            "Pronunciation Check - Case Insensitive", 
            "POST", 
            "pronunciation-check", 
            200, 
            case_test_data
        )
        if success and response.get('result') == 'dogru':
            self.log_test("Case insensitive matching works", True, f"Result: {response.get('result')}")
        else:
            self.log_test("Case insensitive matching works", False, f"Expected 'dogru', got: {response.get('result')}")
        
        # Test 6: Empty/invalid input handling
        invalid_data = {
            "target_word": "",
            "spoken_word": "",
            "word_id": "1"
        }
        success, response = self.run_test(
            "Pronunciation Check - Empty Input", 
            "POST", 
            "pronunciation-check", 
            200, 
            invalid_data
        )
        # Should handle gracefully, not crash

    def test_progress_endpoints(self):
        """Test progress tracking endpoints"""
        print("\n📊 Testing Progress Endpoints...")
        
        if not self.token:
            print("    ❌ No auth token - skipping progress tests")
            return
        
        # Test save progress
        progress_data = {
            "word_id": "1",
            "spoken_word": "kedi",
            "is_correct": True,
            "difficulty": "easy",
            "category": "animals"
        }
        
        self.run_test("Save Progress", "POST", "progress", 200, progress_data)
        
        # Test get user progress
        self.run_test("Get User Progress", "GET", "progress", 200)
        
        # Test get user stats
        self.run_test("Get User Stats", "GET", "stats", 200)

    def test_protected_routes(self):
        """Test that protected routes require authentication"""
        print("\n🔒 Testing Protected Routes...")
        
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        # Test endpoints that should require auth
        protected_endpoints = [
            ("exercises", "GET"),
            ("categories", "GET"), 
            ("progress", "GET"),
            ("stats", "GET"),
            ("auth/me", "GET")
        ]
        
        for endpoint, method in protected_endpoints:
            self.run_test(
                f"Protected Route: {endpoint}", 
                method, 
                endpoint, 
                401  # Should return 401 Unauthorized
            )
        
        # Restore token
        self.token = original_token

    def test_invalid_requests(self):
        """Test error handling for invalid requests"""
        print("\n⚠️ Testing Error Handling...")
        
        # Test invalid login
        invalid_login = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        self.run_test("Invalid Login", "POST", "auth/login", 401, invalid_login)
        
        # Test duplicate registration (if we have a user)
        if self.token:
            duplicate_data = {
                "name": "Duplicate User",
                "email": "test2@example.com",  # Use a potentially existing email
                "password": "TestPass123!"
            }
            # This might return 400 if email exists, or 200 if it doesn't
            success, _ = self.run_test("Duplicate Registration", "POST", "auth/register", 400, duplicate_data)
            if not success:
                # Try with 200 in case email doesn't exist
                self.run_test("Registration (New Email)", "POST", "auth/register", 200, duplicate_data)
        
        # Test non-existent exercise
        if self.token:
            self.run_test("Non-existent Exercise", "GET", "exercises/999999", 404)

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Turkish Speech Therapy API Tests...")
        print(f"📍 Testing API at: {self.base_url}")
        
        try:
            self.test_health_endpoints()
            self.test_auth_flow()
            self.test_exercise_endpoints()
            self.test_pronunciation_check_endpoint()  # New pronunciation tests
            self.test_progress_endpoints()
            self.test_protected_routes()
            self.test_invalid_requests()
            
        except Exception as e:
            print(f"\n💥 Test suite failed with exception: {e}")
            return False
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TurkishSpeechTherapyAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w', encoding='utf-8') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'failed_tests': tester.tests_run - tester.tests_passed,
                'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
                'timestamp': datetime.now().isoformat()
            },
            'detailed_results': tester.test_results
        }, f, indent=2, ensure_ascii=False)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())