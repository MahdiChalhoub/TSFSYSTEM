"""Test script for AES-256-GCM encryption round-trip."""
from erp.encryption import generate_org_key, encrypt_value, decrypt_value, is_encrypted, mask_value

key = generate_org_key()
test_data = 'SSN-123-45-6789'

encrypted = encrypt_value(test_data, key)
decrypted = decrypt_value(encrypted, key)

print('=== AES-256-GCM Encryption Test ===')
print('Key (first 20):', key[:20] + '...')
print('Original:', test_data)
print('Encrypted:', encrypted[:50] + '...')
print('Decrypted:', decrypted)
print('Is encrypted:', is_encrypted(encrypted))
print('Match:', test_data == decrypted)
print('Masked:', mask_value(test_data))
print()

# Test double-encrypt protection
double = encrypt_value(encrypted, key)
print('Double encrypt safe:', double == encrypted)

# Test with bank account
bank = 'LB12-3456-7890-1234-5678-9012'
enc_bank = encrypt_value(bank, key)
dec_bank = decrypt_value(enc_bank, key)
print('Bank round-trip:', bank == dec_bank)

print()
print('ALL TESTS PASSED' if (test_data == decrypted and double == encrypted and bank == dec_bank) else 'TESTS FAILED')
