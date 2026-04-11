"""
Seed remaining 4 tax engine models + create prerequisite records.
Uses raw SQL for Contact/Invoice lookups (different db_column schemes).
"""
from decimal import Decimal
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction, connection


class Command(BaseCommand):
    help = 'Seed remaining 4 tax engine models (BadDebt, AdvancePayment, CreditNote, VATRateHistory)'

    def handle(self, *args, **options):
        from erp.models import Organization
        org = Organization.objects.first()
        if not org:
            self.stderr.write('No org found.')
            return

        org_id = str(org.id)
        today = date.today()
        self.stdout.write(f'\n🏢 Org: {org.name}')

        with transaction.atomic():
            cur = connection.cursor()

            # ── 1) Ensure 3+ contacts ──
            cur.execute("SELECT id FROM contact WHERE organization_id=%s ORDER BY id LIMIT 3", [org_id])
            contact_ids = [r[0] for r in cur.fetchall()]
            self.stdout.write(f'  Existing contacts: {len(contact_ids)}')

            if len(contact_ids) < 3:
                for name, ctype in [
                    ('Moussa Diallo', 'CUSTOMER'),
                    ('Fatou Konaté', 'CUSTOMER'),
                    ('Beaumont Trading SARL', 'SUPPLIER'),
                ]:
                    if len(contact_ids) >= 3:
                        break
                    cur.execute("""
                        INSERT INTO contact (
                            organization_id, name, type, entity_type, status, commercial_status,
                            is_active, balance, credit_limit, loyalty_points, wallet_balance,
                            opening_balance, current_balance, payment_terms_days, interaction_score,
                            airsi_tax_rate, is_airsi_subject, is_eu_supplier,
                            is_vat_exonerated, is_airsi_exonerated,
                            supplier_total_orders, on_time_deliveries, late_deliveries,
                            total_purchase_amount, avg_lead_time_days,
                            quality_rating, delivery_rating, pricing_rating,
                            service_rating, total_ratings, overall_rating,
                            compliance_score, total_orders, lifetime_value, average_order_value,
                            finance_link_status, supplier_vat_regime,
                            compliance_status, compliance_risk_level,
                            followup_status, supplier_category, commercial_category
                        ) VALUES (
                            %s, %s, %s, 'INDIVIDUAL', 'ACTIVE', 'NORMAL',
                            true, 0, 0, 0, 0,
                            0, 0, 30, 0,
                            0, false, false,
                            false, false,
                            0, 0, 0,
                            0, 0,
                            0, 0, 0,
                            0, 0, 0,
                            100, 0, 0, 0,
                            'N_A', 'ASSUJETTI',
                            'COMPLIANT', 'LOW',
                            'ON_TRACK', 'REGULAR', 'NORMAL'
                        ) RETURNING id
                    """, [org_id, name, ctype])
                    cid = cur.fetchone()[0]
                    contact_ids.append(cid)
                    self.stdout.write(f'    Created contact: {name} (#{cid})')
            self.stdout.write(f'  📋 Contacts: {contact_ids}')

            # ── 2) Ensure 3+ invoices ──
            cur.execute("SELECT id FROM invoice WHERE organization_id=%s ORDER BY id LIMIT 3", [org_id])
            invoice_ids = [r[0] for r in cur.fetchall()]
            self.stdout.write(f'  Existing invoices: {len(invoice_ids)}')

            if len(invoice_ids) < 3:
                amounts = [
                    ('2476693.55', '473306.45', '2950000.00'),
                    ('4953387.10', '946612.90', '5900000.00'),
                    ('12758064.52', '2441935.48', '15200000.00'),
                ]
                for i in range(len(invoice_ids), 3):
                    ht, vat, total = amounts[i]
                    cid = contact_ids[min(i, len(contact_ids)-1)]
                    inv_num = f'DEMO-INV-{2026001 + i}'
                    # Get all columns to satisfy NOT NULL constraints
                    cur.execute("""
                        INSERT INTO invoice (
                            organization_id, contact_id, invoice_number, type, sub_type,
                            status, subtotal_ht, tax_amount, total_amount, paid_amount,
                            balance_due, discount_amount, currency, exchange_rate,
                            total_in_functional_currency, default_tax_rate,
                            is_vat_recoverable, is_reverse_charge, display_mode,
                            payment_terms, payment_terms_days, scope,
                            issue_date, due_date, fne_status,
                            payment_blocked, disputed_lines_count, disputed_amount_delta,
                            lifecycle_status, current_verification_level,
                            required_levels_frozen, policy_snapshot
                        ) VALUES (
                            %s, %s, %s, 'SALES', 'RETAIL',
                            'DRAFT', %s, %s, %s, 0,
                            %s, 0, 'XOF', 1,
                            %s, 18,
                            false, false, 'TTC',
                            'NET_30', 30, 'OFFICIAL',
                            %s, %s, 'NONE',
                            false, 0, 0,
                            'OPEN', 0,
                            0, '{}'
                        ) RETURNING id
                    """, [org_id, cid, inv_num, ht, vat, total, total, total,
                          str(today - timedelta(days=200 + i*30)),
                          str(today - timedelta(days=170 + i*30))])
                    iid = cur.fetchone()[0]
                    invoice_ids.append(iid)
                    self.stdout.write(f'    Created invoice: {inv_num} (#{iid})')
            self.stdout.write(f'  📋 Invoices: {invoice_ids}')

            # ── 3) Ensure TaxGroup ──
            cur.execute("SELECT id, name FROM taxgroup WHERE organization_id=%s LIMIT 1", [org_id])
            tg_row = cur.fetchone()
            if tg_row:
                tg_id = tg_row[0]
                self.stdout.write(f'  📋 TaxGroup: {tg_row[1]} (#{tg_id})')
            else:
                cur.execute("""
                    INSERT INTO taxgroup (organization_id, name, rate, is_default, is_active)
                    VALUES (%s, 'TVA Standard 18%%', 18.00, true, true)
                    RETURNING id
                """, [org_id])
                tg_id = cur.fetchone()[0]
                self.stdout.write(f'    Created TaxGroup: TVA Standard 18% (#{tg_id})')

            # ═══════ NOW SEED 4 MODELS via raw SQL ═══════
            # All tax engine ext tables use organization_id (TenantModel)

            # ── BAD DEBT VAT CLAIMS ──
            demo_amounts = [
                ('473306.45', '2950000.00'),
                ('946612.90', '5900000.00'),
                ('2441935.48', '15200000.00'),
            ]
            bad_debt_data = [
                ('ELIGIBLE', 30, None, None, '0',
                 'Customer unresponsive 6+ months. Eligible for VAT recovery.'),
                ('CLAIMED', 60, str(today - timedelta(days=15)), None, '0',
                 'Claim filed with DGI 2026-02-15. Company in judicial liquidation.'),
                ('RECOVERED', 180, str(today - timedelta(days=120)),
                 str(today - timedelta(days=30)), '2441935.48',
                 'Full VAT recovery approved by DGI. Credit applied to Q4 2025.'),
            ]
            for idx, (status, elig_days, claim_dt, recov_dt, recov_amt, note) in enumerate(bad_debt_data):
                vat, total = demo_amounts[idx]
                cur.execute("""
                    INSERT INTO bad_debt_vat_claim (
                        organization_id, invoice_id,
                        original_vat_amount, original_invoice_amount,
                        vat_rate, status, eligible_date,
                        claim_date, recovery_date, recovered_amount,
                        currency_code, notes
                    ) VALUES (
                        %s, %s,
                        %s, %s,
                        0.1800, %s, %s,
                        %s, %s, %s,
                        'XOF', %s
                    )
                """, [org_id, invoice_ids[idx], vat, total, status,
                      str(today - timedelta(days=elig_days)),
                      claim_dt, recov_dt, recov_amt, note])
            self.stdout.write(self.style.SUCCESS('  ✅ 3 Bad Debt VAT Claims'))

            # ── ADVANCE PAYMENT VAT ──
            adv_data = [
                (contact_ids[0], '5900000', '5000000', '900000', 30, 'PENDING',
                 None, 'Client 50% deposit for furniture PO-2026-0234. VAT due upon receipt.'),
                (contact_ids[min(1,len(contact_ids)-1)], '11800000', '10000000', '1800000', 60,
                 'INVOICED', str(today - timedelta(days=10)),
                 'Construction milestone Phase 1. Final invoice issued.'),
                (contact_ids[min(2,len(contact_ids)-1)], '3540000', '3000000', '540000', 15,
                 'VAT_DECLARED', None,
                 'Monthly IT consulting retainer. VAT declared upon receipt.'),
            ]
            for cid, dep, ht, vat, days, status, inv_dt, note in adv_data:
                cur.execute("""
                    INSERT INTO advance_payment_vat (
                        organization_id, contact_id,
                        deposit_amount, deposit_ht, vat_rate, vat_amount,
                        deposit_date, invoice_date, status, currency_code, notes
                    ) VALUES (
                        %s, %s,
                        %s, %s, 0.1800, %s,
                        %s, %s, %s, 'XOF', %s
                    )
                """, [org_id, cid, dep, ht, vat,
                      str(today - timedelta(days=days)), inv_dt, status, note])
            self.stdout.write(self.style.SUCCESS('  ✅ 3 Advance Payment VAT'))

            # ── CREDIT NOTE VAT REVERSALS ──
            for idx, (rtype, orig, rev, credit, is_out, period, note) in enumerate([
                ('PARTIAL', '900000', '450000', '2500000', True, '2026-03',
                 'Partial credit — 50% goods returned damaged. Output VAT -450K.'),
                ('CORRECTION', '1260000', '1260000', '7000000', True, '2026-02',
                 'Wrong client invoiced. Full reversal + re-issuance.'),
                ('DISCOUNT', '540000', '108000', '600000', False, '2026-03',
                 'Supplier 20% volume rebate. Input VAT reduced.'),
            ]):
                cur.execute("""
                    INSERT INTO credit_note_vat_reversal (
                        organization_id, original_invoice_id,
                        reversal_type, original_vat_amount, reversed_vat_amount,
                        credit_amount_ht, vat_rate, is_output_adjustment,
                        vat_return_period, currency_code, notes
                    ) VALUES (
                        %s, %s,
                        %s, %s, %s,
                        %s, 0.1800, %s,
                        %s, 'XOF', %s
                    )
                """, [org_id, invoice_ids[idx], rtype, orig, rev,
                      credit, is_out, period, note])
            self.stdout.write(self.style.SUCCESS('  ✅ 3 Credit Note VAT Reversals'))

            # ── VAT RATE CHANGE HISTORY ──
            for cc, desc, old_r, old_l, new_r, new_l, eff, ann, ref, rule, tn, status, applied, note in [
                ('CI', "Côte d'Ivoire — VAT 18%→20% (planned 2027)",
                 '0.18', '18% Standard', '0.20', '20% Standard',
                 '2027-01-01', '2026-09-15', 'Loi de Finances 2027 Art.342',
                 'INVOICE_DATE', 'Invoices before Jan 1 2027 → 18%. From Jan 1 → 20%.',
                 'UPCOMING', False, 'Planned increase. System switch Jan 1 2027.'),
                ('LB', 'Lebanon — VAT 11%→12%',
                 '0.11', '11% Standard', '0.12', '12% Standard',
                 '2026-01-01', '2025-10-20', 'Budget Law 2026 §7',
                 'EARLIER_OF', 'Rate=earlier of invoice/delivery date.',
                 'ACTIVE', True, 'Applied Jan 1 2026.'),
                ('SN', 'Senegal — Essential goods 18%→10%',
                 '0.18', '18% Standard', '0.10', '10% Essentials',
                 '2025-07-01', '2025-05-15', 'Décret n° 2025-456',
                 'GOVERNMENT_DECREE', 'Only rice, flour, oil, sugar.',
                 'HISTORICAL', True, 'Historical reference.'),
            ]:
                cur.execute("""
                    INSERT INTO vat_rate_change_history (
                        organization_id, tax_group_id,
                        country_code, description,
                        old_rate, old_rate_label,
                        new_rate, new_rate_label,
                        effective_date, announcement_date,
                        gazette_reference, transition_rule,
                        transition_notes, status,
                        applied_to_tax_group, notes
                    ) VALUES (
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s
                    )
                """, [org_id, tg_id, cc, desc,
                      old_r, old_l, new_r, new_l,
                      eff, ann, ref, rule, tn, status, applied, note])
            self.stdout.write(self.style.SUCCESS('  ✅ 3 VAT Rate Change History'))

        self.stdout.write(self.style.SUCCESS(f'\n🎉 All 4 remaining models seeded! Full 11/11 coverage.\n'))
