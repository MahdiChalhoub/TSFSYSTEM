
class BusinessType(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'BusinessType'
    
    def __str__(self):
        return self.name

class GlobalCurrency(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True) # USD, EUR
    symbol = models.CharField(max_length=10) # $, €
    
    class Meta:
        db_table = 'GlobalCurrency'

    def __str__(self):
        return f"{self.name} ({self.code})"
