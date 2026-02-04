from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import AllowAny
from django.db import transaction
from django.utils.text import slugify
from erp.models import (
    Organization, User, Employee, Role, Site, 
    BusinessType, GlobalCurrency
)
from apps.finance.models import FinancialAccount, ChartOfAccount
from .serializers_onboarding import (
    BusinessRegistrationSerializer, UserSignUpSerializer,
    BusinessTypeSerializer, GlobalCurrencySerializer, PublicRoleSerializer
)
from .middleware import get_current_tenant_id

class PublicConfigView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        # 1. Global Lists
        business_types = BusinessType.objects.all()
        currencies = GlobalCurrency.objects.all()
        
        # 2. Tenant Context (if subdomain)
        tenant_context = {}
        tenant_id = get_current_tenant_id()
        
        if tenant_id:
            try:
                org = Organization.objects.get(id=tenant_id)
                roles = Role.objects.filter(organization=org, is_public_requestable=True)
                sites = Site.objects.filter(organization=org, is_active=True).values('id', 'name', 'code')
                
                tenant_context = {
                    'name': org.name,
                    'logo': org.logo.url if org.logo else None,
                    'roles': PublicRoleSerializer(roles, many=True).data,
                    'sites': list(sites)
                }
            except Organization.DoesNotExist:
                pass
        
        return Response({
            'business_types': BusinessTypeSerializer(business_types, many=True).data,
            'currencies': GlobalCurrencySerializer(currencies, many=True).data,
            'tenant': tenant_context
        })

class BusinessRegistrationView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = BusinessRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            with transaction.atomic():
                # 1. Create Organization
                base_slug = data['slug']
                slug = base_slug
                # Ensure uniqueness
                counter = 1
                while Organization.objects.filter(slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                
                org = Organization.objects.create(
                    name=data['business_name'],
                    slug=slug,
                    business_email=data['email'],
                    phone=data.get('phone'),
                    website=data.get('website'),
                    logo=data.get('logo'),
                    address=data.get('address'),
                    city=data.get('city'),
                    state=data.get('state'),
                    zip_code=data.get('zip_code'),
                    country=data.get('country'),
                    timezone=data['timezone'],
                    business_type_id=data['business_type_id'],
                    base_currency_id=data['currency_id']
                )
                
                # 2. Default Site
                main_site = Site.objects.create(
                    organization=org,
                    name=f"{org.name} Main",
                    code="MAIN",
                    is_active=True
                )
                
                # 3. Create Super Admin Role
                admin_role = Role.objects.create(
                    organization=org,
                    name="Super Admin",
                    description="Full Access"
                )
                # Assign all permissions (TODO)
                
                # 4. Create User
                user = User.objects.create_user(
                    username=data['admin_username'],
                    password=data['admin_password'],
                    email=data['admin_email'],
                    first_name=data['admin_first_name'],
                    last_name=data['admin_last_name'],
                    organization=org,
                    role=admin_role,
                    home_site=main_site,
                    is_staff=True, # Giving access to Django Admin for debugging if needed, or internal logic
                    registration_status='APPROVED'
                )
                
                # 5. Create Employee Record
                Employee.objects.create(
                    organization=org,
                    user=user,
                    employee_id=f"EMP-{slug.upper()}-001",
                    first_name=data['admin_first_name'],
                    last_name=data['admin_last_name'],
                    email=data['admin_email'],
                    home_site=main_site,
                    job_title="Owner"
                )
                
                return Response({
                    'message': 'Business registered successfully',
                    'slug': slug,
                    'login_url': f"http://{slug}.localhost:3000/login"
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'detail': f"System Error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

class UserSignUpView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        tenant_id = get_current_tenant_id()
        if not tenant_id:
            return Response({'error': 'Tenant context required'}, status=status.HTTP_400_BAD_REQUEST)
            
        serializer = UserSignUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            with transaction.atomic():
                org = Organization.objects.get(id=tenant_id)
                
                # Check username/email uniqueness within tenant or global? 
                # AbstractUser enforces global username uniqueness.
                if User.objects.filter(username=data['username']).exists():
                    return Response({'error': 'Username already taken'}, status=status.HTTP_400_BAD_REQUEST)
                
                role = Role.objects.get(id=data['role_id'], organization=org)
                if not role.is_public_requestable:
                     return Response({'error': 'Invalid role selection'}, status=status.HTTP_400_BAD_REQUEST)

                # Create User (Pending)
                user = User.objects.create_user(
                    username=data['username'],
                    password=data['password'],
                    email=data['email'],
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                    organization=org,
                    role=role,
                    registration_status='PENDING',
                    is_active=False # Prevent login until approved!
                )
                
                # Create Employee
                emp_count = Employee.objects.filter(organization=org).count() + 1
                Employee.objects.create(
                    organization=org,
                    user=user,
                    employee_id=f"EMP-{org.slug.upper()}-{emp_count:03d}",
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                    email=data['email'],
                    phone=data.get('phone'),
                    nationality=data.get('nationality'),
                    address_line=data.get('address'),
                    date_of_birth=data.get('date_of_birth')
                )
                
                return Response({'message': 'Registration successful. Waiting for approval.'}, status=status.HTTP_201_CREATED)
                
        except Role.DoesNotExist:
             return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
             return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
