"""
SQL Dump Parser for UltimatePOS MySQL exports.
Parses INSERT INTO statements and extracts table data as dictionaries.
"""
import re
import io
import os
import logging
import decimal
from datetime import datetime

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024 # 1MB chunks

class SQLDumpParser:
    """
    Parses a MySQL .sql dump file and extracts INSERT INTO statements.
    Handles multi-row inserts, escaped strings, and large files via streaming.
    """

    TABLE_COLUMNS = {
        'units': ['id', 'business_id', 'actual_name', 'short_name', 'allow_decimal', 'base_unit_id', 'base_unit_multiplier', 'created_by', 'deleted_at', 'created_at', 'updated_at'],
        'categories': ['id', 'name', 'business_id', 'short_code', 'parent_id', 'created_by', 'category_type', 'description', 'slug', 'deleted_at', 'created_at', 'updated_at'],
        'brands': ['id', 'business_id', 'name', 'description', 'created_by', 'deleted_at', 'created_at', 'updated_at'],
        'products': ['id', 'name', 'business_id', 'type', 'unit_id', 'secondary_unit_id', 'sub_unit_ids', 'brand_id', 'category_id', 'sub_category_id', 'tax', 'tax_type', 'enable_stock', 'alert_quantity', 'sku', 'barcode_type', 'expiry_period', 'expiry_period_type', 'enable_sr_no', 'weight', 'product_custom_field1', 'product_custom_field2', 'product_custom_field3', 'product_custom_field4', 'product_custom_field5', 'product_custom_field6', 'product_custom_field7', 'product_custom_field8', 'product_custom_field9', 'product_custom_field10', 'product_custom_field11', 'product_custom_field12', 'product_custom_field13', 'product_custom_field14', 'product_custom_field15', 'product_custom_field16', 'product_custom_field17', 'product_custom_field18', 'product_custom_field19', 'product_custom_field20', 'image', 'product_description', 'created_by', 'preparation_time_in_minutes', 'warranty_id', 'is_inactive', 'not_for_selling', 'created_at', 'updated_at'],
        'variations': ['id', 'name', 'product_id', 'sub_sku', 'product_variation_id', 'variation_value_id', 'default_purchase_price', 'dpp_inc_tax', 'profit_percent', 'default_sell_price', 'sell_price_inc_tax', 'created_at', 'updated_at', 'deleted_at', 'combo_variations'],
        'contacts': ['id', 'business_id', 'type', 'contact_type', 'supplier_business_name', 'name', 'prefix', 'first_name', 'middle_name', 'last_name', 'email', 'contact_id', 'contact_status', 'tax_number', 'city', 'state', 'country', 'address_line_1', 'address_line_2', 'zip_code', 'dob', 'mobile', 'landline', 'alternate_number', 'pay_term_number', 'pay_term_type', 'credit_limit', 'created_by', 'balance', 'total_rp', 'total_rp_used', 'total_rp_expired', 'is_default', 'shipping_address', 'shipping_custom_field_details', 'is_export', 'export_custom_field_1', 'export_custom_field_2', 'export_custom_field_3', 'export_custom_field_4', 'export_custom_field_5', 'export_custom_field_6', 'position', 'customer_group_id', 'custom_field1', 'custom_field2', 'custom_field3', 'custom_field4', 'custom_field5', 'custom_field6', 'custom_field7', 'custom_field8', 'custom_field9', 'custom_field10', 'deleted_at', 'created_at', 'updated_at'],
        'transactions': ['id', 'business_id', 'location_id', 'is_kitchen_order', 'res_table_id', 'res_waiter_id', 'res_order_status', 'type', 'sub_type', 'status', 'sub_status', 'is_quotation', 'payment_status', 'adjustment_type', 'contact_id', 'customer_group_id', 'invoice_no', 'ref_no', 'source', 'subscription_no', 'subscription_repeat_on', 'transaction_date', 'total_before_tax', 'tax_id', 'tax_amount', 'discount_type', 'discount_amount', 'rp_redeemed', 'rp_redeemed_amount', 'shipping_details', 'shipping_address', 'delivery_date', 'shipping_status', 'delivered_to', 'delivery_person', 'shipping_charges', 'shipping_custom_field_1', 'shipping_custom_field_2', 'shipping_custom_field_3', 'shipping_custom_field_4', 'shipping_custom_field_5', 'additional_notes', 'staff_note', 'is_export', 'export_custom_fields_info', 'round_off_amount', 'additional_expense_key_1', 'additional_expense_value_1', 'additional_expense_key_2', 'additional_expense_value_2', 'additional_expense_key_3', 'additional_expense_value_3', 'additional_expense_key_4', 'additional_expense_value_4', 'final_total', 'expense_category_id', 'expense_sub_category_id', 'expense_for', 'commission_agent', 'document', 'is_direct_sale', 'is_suspend', 'exchange_rate', 'total_amount_recovered', 'transfer_parent_id', 'return_parent_id', 'opening_stock_product_id', 'created_by', 'purchase_requisition_ids', 'prefer_payment_method', 'prefer_payment_account', 'sales_order_ids', 'purchase_order_ids', 'custom_field_1', 'custom_field_2', 'custom_field_3', 'custom_field_4', 'import_batch', 'import_time', 'types_of_service_id', 'packing_charge', 'packing_charge_type', 'service_custom_field_1', 'service_custom_field_2', 'service_custom_field_3', 'service_custom_field_4', 'service_custom_field_5', 'service_custom_field_6', 'is_created_from_api', 'rp_earned', 'order_addresses', 'is_recurring', 'recur_interval', 'recur_interval_type', 'recur_repetitions', 'recur_stopped_on', 'recur_parent_id', 'invoice_token', 'pay_term_number', 'pay_term_type', 'selling_price_group_id', 'created_at', 'updated_at'],
        'transaction_sell_lines': ['id', 'transaction_id', 'product_id', 'variation_id', 'quantity', 'secondary_unit_quantity', 'quantity_returned', 'unit_price_before_discount', 'unit_price', 'line_discount_type', 'line_discount_amount', 'unit_price_inc_tax', 'item_tax', 'tax_id', 'discount_id', 'lot_no_line_id', 'sell_line_note', 'so_line_id', 'so_quantity_invoiced', 'res_service_staff_id', 'res_line_order_status', 'parent_sell_line_id', 'children_type', 'sub_unit_id', 'created_at', 'updated_at'],
        'purchase_lines': ['id', 'transaction_id', 'product_id', 'variation_id', 'quantity', 'secondary_unit_quantity', 'pp_without_discount', 'discount_percent', 'purchase_price', 'purchase_price_inc_tax', 'item_tax', 'tax_id', 'purchase_requisition_line_id', 'purchase_order_line_id', 'quantity_sold', 'quantity_adjusted', 'quantity_returned', 'po_quantity_purchased', 'mfg_quantity_used', 'mfg_date', 'exp_date', 'lot_number', 'sub_unit_id', 'created_at', 'updated_at'],
        'transaction_payments': ['id', 'transaction_id', 'business_id', 'is_return', 'amount', 'method', 'payment_type', 'transaction_no', 'card_transaction_number', 'card_number', 'card_type', 'card_holder_name', 'card_month', 'card_year', 'card_security', 'cheque_number', 'bank_account_number', 'paid_on', 'created_by', 'paid_through_link', 'gateway', 'is_advance', 'payment_for', 'parent_id', 'note', 'document', 'payment_ref_no', 'account_id', 'created_at', 'updated_at'],
        'accounts': ['id', 'business_id', 'name', 'account_number', 'account_details', 'account_type_id', 'note', 'created_by', 'is_closed', 'deleted_at', 'created_at', 'updated_at'],
        'account_transactions': ['id', 'account_id', 'type', 'sub_type', 'amount', 'reff_no', 'operation_date', 'created_by', 'transaction_id', 'transaction_payment_id', 'transfer_transaction_id', 'note', 'deleted_at', 'created_at', 'updated_at'],
        'tax_rates': ['id', 'business_id', 'name', 'amount', 'is_tax_group', 'for_tax_group', 'created_by', 'deleted_at', 'created_at', 'updated_at'],
        'business_locations': ['id', 'business_id', 'location_id', 'name', 'landmark', 'country', 'state', 'city', 'zip_code', 'invoice_scheme_id', 'sale_invoice_scheme_id', 'invoice_layout_id', 'sale_invoice_layout_id', 'selling_price_group_id', 'print_receipt_on_invoice', 'receipt_printer_type', 'printer_id', 'mobile', 'alternate_number', 'email', 'website', 'featured_products', 'is_active', 'default_payment_accounts', 'custom_field1', 'custom_field2', 'custom_field3', 'custom_field4', 'deleted_at', 'created_at', 'updated_at'],
        'variation_location_details': ['id', 'product_id', 'product_variation_id', 'variation_id', 'location_id', 'qty_available', 'created_at', 'updated_at'],
        'business': ['id', 'name', 'currency_id', 'start_date', 'tax_number_1', 'tax_label_1', 'tax_number_2', 'tax_label_2', 'default_profit_percent', 'owner_id', 'time_zone', 'date_format', 'time_format', 'fy_start_month', 'accounting_method', 'theme_color', 'created_by', 'is_active', 'pos_settings', 'email_settings', 'sms_settings', 'common_settings', 'is_catering', 'bar_id', 'created_at', 'updated_at'],
        'expense_categories': ['id', 'name', 'business_id', 'code', 'parent_id', 'deleted_at', 'created_at', 'updated_at'],
        'product_variations': ['id', 'variation_template_id', 'name', 'product_id', 'is_dummy', 'created_at', 'updated_at'],
        'stock_adjustment_lines': ['id', 'transaction_id', 'product_id', 'variation_id', 'quantity', 'unit_price', 'removed_purchase_line', 'created_at', 'updated_at'],
        'customer_groups': ['id', 'business_id', 'name', 'amount', 'price_calculation_type', 'selling_price_group_id', 'created_by', 'created_at', 'updated_at'],
        'account_types': ['id', 'name', 'parent_account_type_id', 'business_id', 'created_at', 'updated_at'],
        'users': ['id', 'user_type', 'surname', 'first_name', 'last_name', 'username', 'email', 'password', 'language', 'contact_no', 'address', 'business_id', 'max_sales_discount_percent', 'allow_login', 'status', 'is_cmmsn_agnt', 'cmmsn_percent', 'selected_contacts', 'dob', 'gender', 'marital_status', 'blood_group', 'contact_number', 'fb_link', 'twitter_link', 'social_media_1', 'social_media_2', 'permanent_address', 'current_address', 'guardian_name', 'custom_field_1', 'custom_field_2', 'custom_field_3', 'custom_field_4', 'bank_details', 'id_proof_name', 'id_proof_number', 'crm_contact_id', 'department_id', 'designation_id', 'deleted_at', 'created_at', 'updated_at'],
        'currencies': ['id', 'country', 'currency', 'code', 'symbol', 'thousand_separator', 'decimal_separator', 'created_at', 'updated_at'],
        'account_transactions': ['id', 'account_id', 'amount', 'type', 'sub_type', 'operation_date', 'created_by', 'transaction_id', 'transaction_payment_id', 'transfer_transaction_id', 'note', 'reff_no', 'created_at', 'updated_at'],
        'business_locations': ['id', 'business_id', 'location_id', 'name', 'landmark', 'country', 'state', 'city', 'zip_code', 'mobile', 'alternate_number', 'email', 'website', 'featured_image', 'is_active', 'created_at', 'updated_at'],
        'combo_variations': ['id', 'variation_id', 'variation_id_comp', 'quantity', 'unit_price', 'created_at', 'updated_at'],
    }

    def __init__(self, file_path=None, file_content=None):
        self.file_path = file_path
        self.file_content = file_content
        self.table_offsets = {}

    def parse(self):
        """Initial scan to find table offsets."""
        offsets = {}
        pattern = re.compile(rb"INSERT\s+INTO\s+`?(\w+)`?", re.IGNORECASE)
        buffer = b""
        
        if self.file_path and os.path.exists(self.file_path):
            with open(self.file_path, 'rb') as f:
                while True:
                    chunk = f.read(CHUNK_SIZE)
                    if not chunk: break
                    search_data = buffer + chunk
                    base_offset = f.tell() - len(search_data)
                    for match in pattern.finditer(search_data):
                        table_name = match.group(1).decode('utf-8').lower()
                        offset = base_offset + match.start()
                        if table_name not in offsets: offsets[table_name] = []
                        offsets[table_name].append(offset)
                    buffer = search_data[-4096:]
        
        self.table_offsets = {}
        if self.file_path and os.path.exists(self.file_path):
             with open(self.file_path, 'rb') as f:
                for table, starts in offsets.items():
                    self.table_offsets[table] = []
                    for start in starts:
                        end = self._find_statement_end(f, start)
                        self.table_offsets[table].append((start, end))
        return self.table_offsets

    def _find_statement_end(self, f, start):
        """Robustly find the actual terminal semicolon of an INSERT statement."""
        f.seek(start)
        in_string = False
        string_char = None
        paren_depth = 0
        escaped = False
        
        # Read in chunks to find the terminal semicolon while respecting strings/parens
        # Limitation: reads up to 50MB per statement for performance
        data_limit = 50 * 1024 * 1024
        bytes_read = 0
        
        while bytes_read < data_limit:
            chunk = f.read(CHUNK_SIZE)
            if not chunk: break
            bytes_read += len(chunk)
            
            # For speed, check if chunk has any interesting chars at all
            if b"'" not in chunk and b'"' not in chunk and b';' not in chunk and b'(' not in chunk and b')' not in chunk:
                continue

            block = chunk.decode('utf-8', errors='replace')
            for i, ch in enumerate(block):
                if escaped:
                    escaped = False
                    continue
                if ch == '\\':
                    escaped = True
                    continue

                if in_string:
                    if ch == string_char:
                        in_string = False
                else:
                    if ch in ("'", '"'):
                        in_string = True
                        string_char = ch
                    elif ch == '(':
                        paren_depth += 1
                    elif ch == ')':
                        paren_depth -= 1
                    elif ch == ';' and paren_depth == 0:
                        # Found it! Calculate absolute file position
                        # chunk_start = current_tell - len(chunk)
                        # match_offset = relative pos in block -> convert to bytes
                        # But simpler:
                        return f.tell() - len(chunk) + len(block[:i+1].encode('utf-8'))
        
        return f.tell()

    def stream_rows(self, table_name, business_id=None):
        """Generator that yields parsed rows for a specific table."""
        offsets = self.table_offsets.get(table_name, [])
        if not offsets: return

        with open(self.file_path, 'rb') as f:
            for start, end in offsets:
                f.seek(start)
                # To avoid OOM for giant INSERTs, we check size
                size = end - start
                if size > 5*1024*1024:
                    # TRUE STREAMING for large blocks
                    yield from self._stream_large_block(f, start, end, table_name, business_id)
                else:
                    # Regular parsing for small blocks
                    raw_content = f.read(size)
                    content = raw_content.decode('utf-8', errors='replace')
                    yield from self._parse_block_content(content, table_name, business_id)

    def _parse_block_content(self, content, table_name, business_id=None):
        vals_idx = content.upper().find('VALUES')
        if vals_idx == -1: return
        header = content[:vals_idx]
        values_block = content[vals_idx + 6:].strip()
        if values_block.endswith(';'): values_block = values_block[:-1]
        
        inline_cols_str = None
        col_match = re.search(r"\((.*?)\)", header)
        if col_match: inline_cols_str = col_match.group(1)
        
        if inline_cols_str and '`' in inline_cols_str:
            columns = [c.strip().strip('`').strip() for c in inline_cols_str.split(',')]
        else:
            columns = self.TABLE_COLUMNS.get(table_name)
            
        for row_values in self._parse_values_block(values_block):
            row_dict = self._map_row(row_values, columns)
            if business_id is not None and 'business_id' in row_dict:
                if str(row_dict['business_id']) != str(business_id): continue
            yield row_dict

    def _stream_large_block(self, f, start, end, table_name, business_id=None):
        """Parse a large INSERT block without loading it all into memory."""
        f.seek(start)
        # 1. Find VALUES keyword within first few KB
        head = f.read(64*1024).decode('utf-8', errors='replace')
        vals_idx = head.upper().find('VALUES')
        if vals_idx == -1: return
        
        header = head[:vals_idx]
        inline_cols_str = None
        col_match = re.search(r"\((.*?)\)", header)
        if col_match: inline_cols_str = col_match.group(1)
        
        if inline_cols_str and '`' in inline_cols_str:
            columns = [c.strip().strip('`').strip() for c in inline_cols_str.split(',')]
        else:
            columns = self.TABLE_COLUMNS.get(table_name)

        # 2. Seek to just after VALUES
        f.seek(start + vals_idx + 6)
        
        # 3. Stream characters and parse tuples
        yield from self._parse_values_stream(f, end, columns, business_id)

    def _parse_values_stream(self, f, end_pos, columns, business_id=None):
        """Stream characters from file and yield rows using O(N) list buffer."""
        current_row = []
        chars = []
        in_string = False
        string_char = None
        paren_depth = 0
        
        escaped = False
        while f.tell() < end_pos:
            chunk = f.read(CHUNK_SIZE)
            if not chunk: break
            block = chunk.decode('utf-8', errors='replace')
            for ch in block:
                if escaped:
                    chars.append(ch)
                    escaped = False
                    continue
                
                if ch == '\\':
                    chars.append(ch)
                    escaped = True
                    continue

                if in_string:
                    if ch == string_char:
                        in_string = False
                    chars.append(ch)
                else:
                    if ch in ("'", '"'):
                        in_string = True
                        string_char = ch
                        chars.append(ch)
                    elif ch == '(':
                        if paren_depth == 0:
                            current_row = []
                            chars = []
                        else:
                            chars.append(ch)
                        paren_depth += 1
                    elif ch == ')':
                        paren_depth -= 1
                        if paren_depth == 0:
                            current_value = "".join(chars)
                            current_row.append(current_value.strip())
                            row_dict = self._map_row(current_row, columns)
                            if business_id is None or str(row_dict.get('business_id')) == str(business_id):
                                yield row_dict
                            chars = []
                        else:
                            chars.append(ch)
                    elif ch == ';' and paren_depth == 0:
                        return
                    elif ch == ',' and paren_depth == 1:
                        current_value = "".join(chars)
                        current_row.append(current_value.strip())
                        chars = []
                    elif paren_depth > 0:
                        chars.append(ch)

    def _map_row(self, row_values, columns):
        row_dict = {}
        if columns:
            for i, val in enumerate(row_values):
                col = columns[i] if i < len(columns) else f'_extra_{i}'
                row_dict[col] = self._clean_value(val)
        else:
            row_dict = {f'col_{i}': self._clean_value(v) for i, v in enumerate(row_values)}
        return row_dict

    def _parse_values_block(self, values_block):
        """Original string-based parser for small blocks using list buffer."""
        current_row = []
        chars = []
        in_string = False
        string_char = None
        paren_depth = 0
        escaped = False
        for ch in values_block:
            if escaped:
                chars.append(ch)
                escaped = False
                continue
            if ch == '\\':
                chars.append(ch)
                escaped = True
                continue
                
            if in_string:
                if ch == string_char: in_string = False
                chars.append(ch)
            else:
                if ch in ("'", '"'):
                    in_string = True; string_char = ch
                    chars.append(ch)
                elif ch == '(':
                    if paren_depth == 0: current_row = []; chars = []
                    else: chars.append(ch)
                    paren_depth += 1
                elif ch == ')':
                    paren_depth -= 1
                    if paren_depth == 0:
                        current_value = "".join(chars)
                        current_row.append(current_value.strip())
                        yield current_row
                        chars = []
                    else: chars.append(ch)
                elif ch == ',' and paren_depth == 1:
                    current_value = "".join(chars)
                    current_row.append(current_value.strip())
                    chars = []
                elif paren_depth > 0: chars.append(ch)
        
    def _clean_value(self, value):
        if value is None: return None
        v = value.strip()
        if v.upper() == 'NULL': return None
        if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
            v = v[1:-1]
            return v.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        try:
            if '.' in v: return float(v)
            return int(v)
        except Exception: return v

    def get_businesses(self):
        return list(self.stream_rows('business'))

    def analyze_all_businesses(self):
        analysis = {'global': {}}
        businesses = self.get_businesses()
        for biz in businesses: analysis[str(biz['id'])] = {}
        relevant_tables = list(self.TABLE_COLUMNS.keys())
        
        # Optimization: Map transactions and products to businesses
        tx_to_biz = {}
        prod_to_biz = {}
        
        for table in relevant_tables:
            if table not in self.table_offsets: continue
            global_count = 0
            for row in self.stream_rows(table):
                global_count += 1
                biz_id = str(row.get('business_id')) if 'business_id' in row else None
                
                # Record ownership for child resolution
                row_id = str(row.get('id'))
                if table == 'transactions' and biz_id:
                    tx_to_biz[row_id] = biz_id
                elif table == 'products' and biz_id:
                    prod_to_biz[row_id] = biz_id

                # Try to resolve biz_id for child tables
                if not biz_id:
                    if 'transaction_id' in row:
                        biz_id = tx_to_biz.get(str(row.get('transaction_id')))
                    elif 'product_id' in row:
                        biz_id = prod_to_biz.get(str(row.get('product_id')))
                
                # Transaction specifics (expenses, returns)
                if table == 'transactions':
                    t_type = row.get('type')
                    key = None
                    if t_type == 'expense': key = 'expenses'
                    elif t_type in ('sell_return', 'purchase_return'): key = 'returns'
                    if key:
                        analysis['global'][key] = analysis['global'].get(key, 0) + 1
                        if biz_id and biz_id in analysis:
                            analysis[biz_id][key] = analysis[biz_id].get(key, 0) + 1

                # Update counts
                if biz_id and biz_id in analysis:
                    analysis[biz_id][table] = analysis[biz_id].get(table, 0) + 1
            analysis['global'][table] = global_count
        return analysis, businesses

class DirectDBReader:
    def __init__(self, host, port, database, user, password):
        self.host = host; self.port = port; self.database = database; self.user = user; self.password = password
        self.connection = None
    def connect(self):
        import pymysql
        self.connection = pymysql.connect(host=self.host, port=self.port, database=self.database, user=self.user, password=self.password, charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)
    def read_table(self, table_name, where_clause=None):
        if not self.connection: self.connect()
        import pymysql
        with self.connection.cursor(pymysql.cursors.SSDictCursor) as cursor:
            sql = f"SELECT * FROM `{table_name}`"
            if where_clause: sql += f" WHERE {where_clause}"
            cursor.execute(sql)
            while True:
                row = cursor.fetchone()
                if not row: break
                yield row
    def get_table_counts(self, where_clause=None):
        if not self.connection: self.connect()
        counts = {}
        for table_name in SQLDumpParser.TABLE_COLUMNS.keys():
            try:
                with self.connection.cursor() as cursor:
                    sql = f"SELECT COUNT(*) as cnt FROM `{table_name}`"
                    if where_clause: sql += f" WHERE {where_clause}"
                    cursor.execute(sql)
                    result = cursor.fetchone()
            except Exception as e:
                logger.error(f"Error reading table count for {table_name}: {e}")
                counts[table_name] = 0
        return counts
    def analyze_all_businesses(self):
        if not self.connection: self.connect()
        businesses_raw = list(self.read_table('business'))
        businesses = [{'id': b.get('id'), 'name': b.get('name', f"Business #{b.get('id')}")} for b in businesses_raw]
        analysis = {'global': self.get_table_counts()}
        for biz in businesses:
            biz_id = biz['id']
            analysis[str(biz_id)] = self.get_table_counts(f"business_id = {biz_id}")
        return analysis, businesses
    def close(self):
        if self.connection: self.connection.close(); self.connection = None
