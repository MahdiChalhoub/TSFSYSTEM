"""
SQL Dump Parser for UltimatePOS MySQL exports.
Parses INSERT INTO statements and extracts table data as dictionaries.
"""
import re
import io
import logging

logger = logging.getLogger(__name__)


class SQLDumpParser:
    """
    Parses a MySQL .sql dump file and extracts INSERT INTO statements.
    Handles multi-row inserts, escaped strings, and large files via streaming.
    """

    # Column definitions extracted from the UltimatePOS schema
    TABLE_COLUMNS = {
        'units': [
            'id', 'business_id', 'actual_name', 'short_name', 'allow_decimal',
            'base_unit_id', 'base_unit_multiplier', 'created_by', 'deleted_at',
            'created_at', 'updated_at'
        ],
        'categories': [
            'id', 'name', 'business_id', 'short_code', 'parent_id', 'created_by',
            'category_type', 'description', 'slug', 'deleted_at', 'created_at',
            'updated_at'
        ],
        'brands': [
            'id', 'business_id', 'name', 'description', 'created_by',
            'deleted_at', 'created_at', 'updated_at'
        ],
        'products': [
            'id', 'name', 'business_id', 'type', 'unit_id', 'secondary_unit_id',
            'sub_unit_ids', 'brand_id', 'category_id', 'sub_category_id', 'tax',
            'tax_type', 'enable_stock', 'alert_quantity', 'sku', 'barcode_type',
            'expiry_period', 'expiry_period_type', 'enable_sr_no', 'weight',
            'product_custom_field1', 'product_custom_field2', 'product_custom_field3',
            'product_custom_field4', 'product_custom_field5', 'product_custom_field6',
            'product_custom_field7', 'product_custom_field8', 'product_custom_field9',
            'product_custom_field10', 'product_custom_field11', 'product_custom_field12',
            'product_custom_field13', 'product_custom_field14', 'product_custom_field15',
            'product_custom_field16', 'product_custom_field17', 'product_custom_field18',
            'product_custom_field19', 'product_custom_field20',
            'image', 'product_description', 'created_by', 'preparation_time_in_minutes',
            'warranty_id', 'is_inactive', 'not_for_selling', 'created_at', 'updated_at'
        ],
        'variations': [
            'id', 'name', 'product_id', 'sub_sku', 'product_variation_id',
            'variation_value_id', 'default_purchase_price', 'dpp_inc_tax',
            'profit_percent', 'default_sell_price', 'sell_price_inc_tax',
            'created_at', 'updated_at', 'deleted_at', 'combo_variations'
        ],
        'contacts': [
            'id', 'business_id', 'type', 'contact_type', 'supplier_business_name',
            'name', 'prefix', 'first_name', 'middle_name', 'last_name', 'email',
            'contact_id', 'contact_status', 'tax_number', 'city', 'state', 'country',
            'address_line_1', 'address_line_2', 'zip_code', 'dob', 'mobile', 'landline',
            'alternate_number', 'pay_term_number', 'pay_term_type', 'credit_limit',
            'created_by', 'balance', 'total_rp', 'total_rp_used', 'total_rp_expired',
            'is_default', 'shipping_address', 'shipping_custom_field_details',
            'is_export', 'export_custom_field_1', 'export_custom_field_2',
            'export_custom_field_3', 'export_custom_field_4', 'export_custom_field_5',
            'export_custom_field_6', 'position', 'customer_group_id',
            'custom_field1', 'custom_field2', 'custom_field3', 'custom_field4',
            'custom_field5', 'custom_field6', 'custom_field7', 'custom_field8',
            'custom_field9', 'custom_field10', 'deleted_at', 'created_at', 'updated_at'
        ],
        'transactions': [
            'id', 'business_id', 'location_id', 'is_kitchen_order', 'res_table_id',
            'res_waiter_id', 'res_order_status', 'type', 'sub_type', 'status',
            'sub_status', 'is_quotation', 'payment_status', 'adjustment_type',
            'contact_id', 'customer_group_id', 'invoice_no', 'ref_no', 'source',
            'subscription_no', 'subscription_repeat_on', 'transaction_date',
            'total_before_tax', 'tax_id', 'tax_amount', 'discount_type',
            'discount_amount', 'rp_redeemed', 'rp_redeemed_amount',
            'shipping_details', 'shipping_address', 'delivery_date',
            'shipping_status', 'delivered_to', 'delivery_person', 'shipping_charges',
            'shipping_custom_field_1', 'shipping_custom_field_2',
            'shipping_custom_field_3', 'shipping_custom_field_4',
            'shipping_custom_field_5', 'additional_notes', 'staff_note',
            'is_export', 'export_custom_fields_info', 'round_off_amount',
            'additional_expense_key_1', 'additional_expense_value_1',
            'additional_expense_key_2', 'additional_expense_value_2',
            'additional_expense_key_3', 'additional_expense_value_3',
            'additional_expense_key_4', 'additional_expense_value_4',
            'final_total', 'expense_category_id', 'expense_sub_category_id',
            'expense_for', 'commission_agent', 'document', 'is_direct_sale',
            'is_suspend', 'exchange_rate', 'total_amount_recovered',
            'transfer_parent_id', 'return_parent_id', 'opening_stock_product_id',
            'created_by', 'purchase_requisition_ids', 'prefer_payment_method',
            'prefer_payment_account', 'sales_order_ids', 'purchase_order_ids',
            'custom_field_1', 'custom_field_2', 'custom_field_3', 'custom_field_4',
            'import_batch', 'import_time', 'types_of_service_id', 'packing_charge',
            'packing_charge_type', 'service_custom_field_1', 'service_custom_field_2',
            'service_custom_field_3', 'service_custom_field_4', 'service_custom_field_5',
            'service_custom_field_6', 'is_created_from_api', 'rp_earned',
            'order_addresses', 'is_recurring', 'recur_interval', 'recur_interval_type',
            'recur_repetitions', 'recur_stopped_on', 'recur_parent_id',
            'invoice_token', 'pay_term_number', 'pay_term_type',
            'selling_price_group_id', 'created_at', 'updated_at'
        ],
        'transaction_sell_lines': [
            'id', 'transaction_id', 'product_id', 'variation_id', 'quantity',
            'secondary_unit_quantity', 'quantity_returned',
            'unit_price_before_discount', 'unit_price', 'line_discount_type',
            'line_discount_amount', 'unit_price_inc_tax', 'item_tax', 'tax_id',
            'discount_id', 'lot_no_line_id', 'sell_line_note', 'so_line_id',
            'so_quantity_invoiced', 'res_service_staff_id', 'res_line_order_status',
            'parent_sell_line_id', 'children_type', 'sub_unit_id',
            'created_at', 'updated_at'
        ],
        'purchase_lines': [
            'id', 'transaction_id', 'product_id', 'variation_id', 'quantity',
            'secondary_unit_quantity', 'pp_without_discount', 'discount_percent',
            'purchase_price', 'purchase_price_inc_tax', 'item_tax', 'tax_id',
            'purchase_requisition_line_id', 'purchase_order_line_id',
            'quantity_sold', 'quantity_adjusted', 'quantity_returned',
            'po_quantity_purchased', 'mfg_quantity_used', 'mfg_date', 'exp_date',
            'lot_number', 'sub_unit_id', 'created_at', 'updated_at'
        ],
        'transaction_payments': [
            'id', 'transaction_id', 'business_id', 'is_return', 'amount', 'method',
            'payment_type', 'transaction_no', 'card_transaction_number', 'card_number',
            'card_type', 'card_holder_name', 'card_month', 'card_year', 'card_security',
            'cheque_number', 'bank_account_number', 'paid_on', 'created_by',
            'paid_through_link', 'gateway', 'is_advance', 'payment_for', 'parent_id',
            'note', 'document', 'payment_ref_no', 'account_id',
            'created_at', 'updated_at'
        ],
        'accounts': [
            'id', 'business_id', 'name', 'account_number', 'account_details',
            'account_type_id', 'note', 'created_by', 'is_closed',
            'deleted_at', 'created_at', 'updated_at'
        ],
        'account_transactions': [
            'id', 'account_id', 'type', 'sub_type', 'amount', 'reff_no',
            'operation_date', 'created_by', 'transaction_id',
            'transaction_payment_id', 'transfer_transaction_id', 'note',
            'deleted_at', 'created_at', 'updated_at'
        ],
        'tax_rates': [
            'id', 'business_id', 'name', 'amount', 'is_tax_group',
            'for_tax_group', 'created_by', 'deleted_at', 'created_at', 'updated_at'
        ],
        'business_locations': [
            'id', 'business_id', 'location_id', 'name', 'landmark', 'country',
            'state', 'city', 'zip_code', 'invoice_scheme_id',
            'sale_invoice_scheme_id', 'invoice_layout_id', 'sale_invoice_layout_id',
            'selling_price_group_id', 'print_receipt_on_invoice',
            'receipt_printer_type', 'printer_id', 'mobile', 'alternate_number',
            'email', 'website', 'featured_products', 'is_active',
            'default_payment_accounts', 'custom_field1', 'custom_field2',
            'custom_field3', 'custom_field4', 'deleted_at', 'created_at', 'updated_at'
        ],
        'variation_location_details': [
            'id', 'product_id', 'product_variation_id', 'variation_id',
            'location_id', 'qty_available', 'created_at', 'updated_at'
        ],
    }

    def __init__(self, file_path=None, file_content=None):
        self.file_path = file_path
        self.file_content = file_content
        # Map of table_name -> list of (start_offset, end_offset)
        self.table_offsets = {}
        # Cached counts
        self.table_counts = {}

    def parse(self):
        """
        Scan the SQL dump to find INSERT INTO statements and record their locations.
        Does NOT load row data into memory yet.
        """
        if self.file_content:
            # Fallback for string content (not recommended for large files)
            content_io = io.StringIO(self.file_content)
            self._scan_stream(content_io)
            return self.table_offsets

        if not self.file_path or not os.path.exists(self.file_path):
            raise ValueError(f"File not found: {self.file_path}")

        with open(self.file_path, 'r', encoding='utf-8', errors='replace') as f:
            self._scan_stream(f)

        return self.table_offsets

    def _scan_stream(self, stream):
        """Scan a stream for INSERT statements and record offsets."""
        import os
        # Pattern to find start of INSERT
        # We look for "INSERT INTO `table`"
        pattern = re.compile(r"INSERT\s+INTO\s+`?(\w+)`?", re.IGNORECASE)
        
        self.table_offsets = {}
        self.table_counts = {}
        
        # We read line-by-line to find INSERT starts
        # For large multi-line INSERTs, we need to find the ending semicolon
        while True:
            offset = stream.tell()
            line = stream.readline()
            if not line:
                break
            
            match = pattern.search(line)
            if match:
                table_name = match.group(1)
                if table_name not in self.table_offsets:
                    self.table_offsets[table_name] = []
                
                # Find the end of this statement (semicolon)
                statement_start = offset
                statement_end = -1
                
                # Check if semicolon is on the same line
                if ';' in line:
                    statement_end = offset + line.find(';') + 1
                else:
                    # Scan subsequent lines for the semicolon
                    while True:
                        inner_offset = stream.tell()
                        inner_line = stream.readline()
                        if not inner_line:
                            break
                        if ';' in inner_line:
                            statement_end = inner_offset + inner_line.find(';') + 1
                            break
                
                if statement_end != -1:
                    self.table_offsets[table_name].append((statement_start, statement_end))
        
        logger.info(f"Scanned SQL dump. Found {len(self.table_offsets)} tables with INSERT statements.")

    def stream_rows(self, table_name, business_id=None):
        """
        Generator that yields parsed rows for a specific table.
        Optionally filters by business_id in-stream.
        """
        offsets = self.table_offsets.get(table_name, [])
        if not offsets:
            return

        with open(self.file_path, 'r', encoding='utf-8', errors='replace') as f:
            for start, end in offsets:
                f.seek(start)
                content = f.read(end - start)
                
                # Parse this specific statement
                pattern = r"INSERT\s+INTO\s+`?(\w+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+?);"
                match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
                if not match:
                    continue
                
                _, inline_cols_str, values_block = match.groups()
                rows_data = self._parse_values_block(values_block)
                
                # Determine columns
                if inline_cols_str and '`' in inline_cols_str:
                    columns = [c.strip().strip('`').strip() for c in inline_cols_str.split(',')]
                else:
                    columns = self.TABLE_COLUMNS.get(table_name)
                
                for row_values in rows_data:
                    row_dict = {}
                    if columns:
                        for i, val in enumerate(row_values):
                            col = columns[i] if i < len(columns) else f'_extra_{i}'
                            row_dict[col] = self._clean_value(val)
                    else:
                        row_dict = {f'col_{i}': self._clean_value(v) for i, v in enumerate(row_values)}
                    
                    # Filter by business_id if requested
                    if business_id is not None and 'business_id' in row_dict:
                        if str(row_dict['business_id']) != str(business_id):
                            continue
                    
                    yield row_dict

    def get_businesses(self):
        """Extract business records by streaming the 'business' table."""
        return list(self.stream_rows('business'))

    def analyze_all_businesses(self):
        """
        Scan all relevant tables in one pass to count records per business.
        Returns {business_id: {table_name: count}, 'global': {table_name: count}}
        """
        analysis = {'global': {}}
        businesses = self.get_businesses()
        for biz in businesses:
            analysis[str(biz['id'])] = {}

        relevant_tables = list(self.TABLE_COLUMNS.keys())
        
        for table in relevant_tables:
            if table not in self.table_offsets:
                continue
            
            global_count = 0
            for row in self.stream_rows(table):
                global_count += 1
                biz_id = str(row.get('business_id')) if 'business_id' in row else None
                if biz_id and biz_id in analysis:
                    analysis[biz_id][table] = analysis[biz_id].get(table, 0) + 1
            
            analysis['global'][table] = global_count
            
        return analysis, businesses

    def _parse_values_block(self, values_block):
        """Parse the VALUES (...), (...), ... block into list of tuples."""
        rows = []
        current_row = []
        current_value = ''
        in_string = False
        string_char = None
        paren_depth = 0
        i = 0

        while i < len(values_block):
            ch = values_block[i]

            if in_string:
                if ch == '\\' and i + 1 < len(values_block):
                    current_value += ch + values_block[i + 1]
                    i += 2
                    continue
                elif ch == string_char:
                    # Check for escaped quote (doubled)
                    if i + 1 < len(values_block) and values_block[i + 1] == string_char:
                        current_value += ch
                        i += 2
                        continue
                    in_string = False
                    current_value += ch
                else:
                    current_value += ch
            else:
                if ch in ("'", '"'):
                    in_string = True
                    string_char = ch
                    current_value += ch
                elif ch == '(':
                    if paren_depth == 0:
                        current_row = []
                        current_value = ''
                    else:
                        current_value += ch
                    paren_depth += 1
                elif ch == ')':
                    paren_depth -= 1
                    if paren_depth == 0:
                        current_row.append(current_value.strip())
                        rows.append(current_row)
                        current_value = ''
                    else:
                        current_value += ch
                elif ch == ',' and paren_depth == 1:
                    current_row.append(current_value.strip())
                    current_value = ''
                elif paren_depth > 0:
                    current_value += ch

            i += 1

        return rows

    def _clean_value(self, value):
        """Clean a parsed SQL value into a Python type."""
        if value is None:
            return None

        v = value.strip()

        if v.upper() == 'NULL':
            return None

        # Remove surrounding quotes
        if (v.startswith("'") and v.endswith("'")) or \
           (v.startswith('"') and v.endswith('"')):
            v = v[1:-1]
            # Unescape
            v = v.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
            v = v.replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
            return v

        # Boolean-ish
        if v == '0':
            return 0
        if v == '1':
            return 1

        # Try numeric
        try:
            if '.' in v:
                return float(v)
            return int(v)
        except (ValueError, TypeError):
            pass

        return v


class DirectDBReader:
    """
    Reads data directly from a remote UltimatePOS MySQL database.
    Requires pymysql.
    """

    def __init__(self, host, port, database, user, password):
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.connection = None

    def connect(self):
        """Establish connection to the remote MySQL database."""
        try:
            import pymysql
        except ImportError:
            raise ImportError("pymysql is required for direct DB connection. Install with: pip install pymysql")

        self.connection = pymysql.connect(
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.user,
            password=self.password,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )

    def read_table(self, table_name, where_clause=None):
        """Read rows from a table using a streaming cursor (yields rows)."""
        if not self.connection:
            self.connect()

        import pymysql
        # Use a separate streaming cursor
        with self.connection.cursor(pymysql.cursors.SSDictCursor) as cursor:
            sql = f"SELECT * FROM `{table_name}`"
            if where_clause:
                sql += f" WHERE {where_clause}"
            cursor.execute(sql)
            while True:
                row = cursor.fetchone()
                if not row:
                    break
                yield row

    def get_table_counts(self, where_clause=None):
        """Get row counts for all known tables, optionally filtered."""
        if not self.connection:
            self.connect()

        counts = {}
        for table_name in SQLDumpParser.TABLE_COLUMNS.keys():
            try:
                with self.connection.cursor() as cursor:
                    sql = f"SELECT COUNT(*) as cnt FROM `{table_name}`"
                    if where_clause:
                        sql += f" WHERE {where_clause}"
                    cursor.execute(sql)
                    result = cursor.fetchone()
                    counts[table_name] = result.get('cnt', 0) if result else 0
            except Exception:
                counts[table_name] = 0
        return counts

    def analyze_all_businesses(self):
        """Analyze business counts efficiently using SQL aggregations."""
        if not self.connection:
            self.connect()
        
        businesses_raw = list(self.read_table('business'))
        businesses = [
            {'id': b.get('id'), 'name': b.get('name', f"Business #{b.get('id')}")}
            for b in businesses_raw
        ]
        
        analysis = {'global': self.get_table_counts()}
        for biz in businesses:
            biz_id = biz['id']
            # Only count for tables that have business_id
            analysis[str(biz_id)] = self.get_table_counts(f"business_id = {biz_id}")
            
        return analysis, businesses

    def close(self):
        """Close the connection."""
        if self.connection:
            self.connection.close()
            self.connection = None
