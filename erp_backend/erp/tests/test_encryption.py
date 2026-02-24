"""
Kernel — Encryption Tests
===========================
Tests for the AES-256-GCM field-level encryption utility.
Covers: round-trip encrypt/decrypt, no double-encryption,
        key length validation, tampered data detection, masking.
"""
from django.test import TestCase

from erp.encryption import (
    generate_org_key, encrypt_value, decrypt_value,
    is_encrypted, mask_value, ENCRYPTED_PREFIX,
)


class TestKeyGeneration(TestCase):
    """Tests for key generation."""

    def test_generates_valid_key(self):
        """Generated key should be a non-empty base64 string."""
        key = generate_org_key()
        self.assertIsNotNone(key)
        self.assertTrue(len(key) > 0)

    def test_keys_are_unique(self):
        """Each generated key should be unique."""
        keys = {generate_org_key() for _ in range(100)}
        self.assertEqual(len(keys), 100)


class TestEncryptDecrypt(TestCase):
    """Tests for encrypt/decrypt round-trip."""

    def setUp(self):
        self.key = generate_org_key()

    def test_round_trip_basic(self):
        """Encrypting and decrypting should return the original value."""
        plaintext = 'SSN-123-45-6789'
        encrypted = encrypt_value(plaintext, self.key)
        decrypted = decrypt_value(encrypted, self.key)
        self.assertEqual(decrypted, plaintext)

    def test_round_trip_unicode(self):
        """Should handle Unicode characters correctly."""
        plaintext = '日本語テスト 🔐 Ñoño'
        encrypted = encrypt_value(plaintext, self.key)
        decrypted = decrypt_value(encrypted, self.key)
        self.assertEqual(decrypted, plaintext)

    def test_round_trip_long_text(self):
        """Should handle long text values."""
        plaintext = 'A' * 10000
        encrypted = encrypt_value(plaintext, self.key)
        decrypted = decrypt_value(encrypted, self.key)
        self.assertEqual(decrypted, plaintext)

    def test_round_trip_empty_returns_empty(self):
        """Empty string should return empty (not encrypted)."""
        result = encrypt_value('', self.key)
        self.assertEqual(result, '')

    def test_round_trip_none_returns_none(self):
        """None should return None (not encrypted)."""
        result = encrypt_value(None, self.key)
        self.assertIsNone(result)

    def test_encrypted_value_has_prefix(self):
        """Encrypted values should start with 'enc:' prefix."""
        encrypted = encrypt_value('secret', self.key)
        self.assertTrue(encrypted.startswith(ENCRYPTED_PREFIX))

    def test_no_double_encryption(self):
        """Encrypting an already-encrypted value should return it unchanged."""
        encrypted = encrypt_value('secret', self.key)
        double_encrypted = encrypt_value(encrypted, self.key)
        self.assertEqual(encrypted, double_encrypted)

    def test_same_plaintext_different_ciphertexts(self):
        """Same plaintext should produce different ciphertexts (random nonce)."""
        ciphertexts = {encrypt_value('same-value', self.key) for _ in range(10)}
        self.assertEqual(len(ciphertexts), 10)


class TestDecryptionFailures(TestCase):
    """Tests for invalid decryption scenarios."""

    def setUp(self):
        self.key = generate_org_key()

    def test_wrong_key_raises_error(self):
        """Decrypting with a wrong key should raise an error."""
        encrypted = encrypt_value('secret', self.key)
        wrong_key = generate_org_key()
        with self.assertRaises(Exception):
            decrypt_value(encrypted, wrong_key)

    def test_tampered_ciphertext_raises_error(self):
        """Tampered ciphertext should fail authentication."""
        encrypted = encrypt_value('secret', self.key)
        # Tamper with the ciphertext
        parts = encrypted.split(':')
        tampered = parts[0] + ':' + parts[1] + ':' + 'AAAA' + parts[2][4:]
        with self.assertRaises(Exception):
            decrypt_value(tampered, self.key)

    def test_unencrypted_value_returns_as_is(self):
        """Decrypting a non-encrypted value should return it as-is."""
        plaintext = 'not-encrypted'
        result = decrypt_value(plaintext, self.key)
        self.assertEqual(result, plaintext)

    def test_invalid_format_raises_error(self):
        """Invalid encrypted format should raise ValueError."""
        with self.assertRaises(Exception):
            decrypt_value('enc:invalid', self.key)


class TestIsEncrypted(TestCase):
    """Tests for the is_encrypted utility."""

    def test_encrypted_string_detected(self):
        key = generate_org_key()
        encrypted = encrypt_value('test', key)
        self.assertTrue(is_encrypted(encrypted))

    def test_plain_string_not_detected(self):
        self.assertFalse(is_encrypted('hello world'))

    def test_none_not_detected(self):
        self.assertFalse(is_encrypted(None))

    def test_empty_not_detected(self):
        self.assertFalse(is_encrypted(''))


class TestMaskValue(TestCase):
    """Tests for the mask_value display utility."""

    def test_masks_with_last_4_visible(self):
        result = mask_value('SSN-123-45-6789')
        self.assertTrue(result.endswith('6789'))
        self.assertTrue(result.startswith('•'))

    def test_short_value_fully_masked(self):
        result = mask_value('AB')
        self.assertEqual(result, '••')

    def test_custom_visible_chars(self):
        result = mask_value('1234567890', visible_chars=6)
        self.assertTrue(result.endswith('567890'))
        self.assertEqual(result.count('•'), 4)

    def test_empty_returns_empty(self):
        self.assertIsNone(mask_value(None))
        self.assertEqual(mask_value(''), '')
