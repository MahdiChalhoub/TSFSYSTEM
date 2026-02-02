from decimal import Decimal
try:
    print(f"Decimal * int: {Decimal('10.5') * 10}")
    print(f"Decimal * float: {Decimal('10.5') * 1.5}")
except TypeError as e:
    print(f"Decimal * float FAILED as expected: {e}")
