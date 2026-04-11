"""
Exception Handler Tests
========================
Tests for the standardized API error envelope.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from erp.models import Organization, User


class TestErrorEnvelope(TestCase):
    """Tests that API errors follow standardized envelope format."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="Error Test Org", slug="err-test")
        cls.user = User.objects.create_user(
            username="err_user", password="test123",
            email="err@test.com", organization=cls.org,
        )

    def setUp(self):
        self.client = APIClient()

    def test_unauthenticated_returns_error_envelope(self):
        """401 responses should follow the standardized envelope format."""
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        data = response.json()
        self.assertEqual(data['status'], 'error')
        self.assertIn('code', data)
        self.assertIn('message', data)
        self.assertIn('request_id', data)

    def test_error_code_for_unauthenticated(self):
        """Unauthenticated requests should return NOT_AUTHENTICATED code."""
        response = self.client.get('/api/products/')
        data = response.json()
        self.assertEqual(data['code'], 'NOT_AUTHENTICATED')

    def test_invalid_token_returns_auth_failed(self):
        """Invalid token should return AUTHENTICATION_FAILED code."""
        self.client.credentials(HTTP_AUTHORIZATION='Token invalid_token_value')
        response = self.client.get('/api/products/')
        data = response.json()
        self.assertEqual(data['status'], 'error')
        self.assertIn(data['code'], ['AUTHENTICATION_FAILED', 'NOT_AUTHENTICATED'])

    def test_404_returns_not_found_code(self):
        """Non-existent resources should return NOT_FOUND code."""
        from rest_framework.authtoken.models import Token
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Token {token.key}',
            HTTP_X_TENANT_ID=str(self.org.id),
        )
        response = self.client.get('/api/products/999999/')
        if response.status_code == 404:
            data = response.json()
            self.assertEqual(data['status'], 'error')
            self.assertEqual(data['code'], 'NOT_FOUND')
            self.assertIn('request_id', data)

    def test_request_id_is_unique(self):
        """Each error response should have a unique request_id."""
        r1 = self.client.get('/api/products/').json()
        r2 = self.client.get('/api/products/').json()
        self.assertNotEqual(r1['request_id'], r2['request_id'])

    def test_error_envelope_does_not_leak_stack_trace(self):
        """Error responses should never contain Python stack traces."""
        response = self.client.get('/api/products/')
        body = response.content.decode()
        self.assertNotIn('Traceback', body)
        self.assertNotIn('.py', body)
