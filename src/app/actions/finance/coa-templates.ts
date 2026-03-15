'use server'


import { revalidatePath } from 'next/cache'
import { getTenantContext } from '@/lib/erp-api'
import { applyAutoDetect } from './posting-rules'

type TemplateAccount = {
    code: string
    name: string
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
    subType?: string
    syscohadaCode?: string
    syscohadaClass?: string
    isSystemOnly?: boolean
    isHidden?: boolean
    requiresZeroBalance?: boolean
    children?: TemplateAccount[]
}

const LEBANESE_PCN: TemplateAccount[] = [
    {
        code: '1', name: 'Capitaux et Passif Non Courant', type: 'EQUITY', children: [
            {
                code: '10', name: 'Capital', type: 'EQUITY', children: [
                    { code: '101', name: 'Capital social', type: 'EQUITY' },
                    { code: '106', name: 'Primes liées au capital', type: 'EQUITY' },
                ]
            },
            {
                code: '11', name: 'Réserves', type: 'EQUITY', children: [
                    { code: '111', name: 'Réserve légale', type: 'EQUITY' },
                    { code: '112', name: 'Réserves statutaires', type: 'EQUITY' },
                    { code: '115', name: 'Réserves facultatives', type: 'EQUITY' },
                ]
            },
            { code: '12', name: 'Résultat reporté', type: 'EQUITY' },
            { code: '13', name: 'Résultat de l\'exercice', type: 'EQUITY' },
            {
                code: '15', name: 'Provisions pour risques', type: 'LIABILITY', children: [
                    { code: '151', name: 'Provisions pour litiges', type: 'LIABILITY' },
                    { code: '153', name: 'Provisions pour restructurations', type: 'LIABILITY' },
                ]
            },
            {
                code: '16', name: 'Emprunts et dettes assimilées', type: 'LIABILITY', children: [
                    { code: '161', name: 'Emprunts bancaires long terme', type: 'LIABILITY' },
                    { code: '164', name: 'Dettes envers établissements de crédit', type: 'LIABILITY' },
                ]
            },
        ]
    },
    {
        code: '2', name: 'Actif Non Courant (Immobilisations)', type: 'ASSET', children: [
            {
                code: '21', name: 'Immobilisations incorporelles', type: 'ASSET', children: [
                    { code: '211', name: 'Fonds commercial', type: 'ASSET' },
                    { code: '212', name: 'Brevets et licences', type: 'ASSET' },
                    { code: '215', name: 'Logiciels', type: 'ASSET' },
                ]
            },
            { code: '22', name: 'Terrains', type: 'ASSET' },
            {
                code: '23', name: 'Constructions', type: 'ASSET', children: [
                    { code: '231', name: 'Bâtiments', type: 'ASSET' },
                    { code: '232', name: 'Agencements des constructions', type: 'ASSET' },
                ]
            },
            {
                code: '24', name: 'Matériel et outillage', type: 'ASSET', children: [
                    { code: '241', name: 'Matériel industriel', type: 'ASSET' },
                    { code: '244', name: 'Mobilier de bureau', type: 'ASSET' },
                    { code: '245', name: 'Matériel informatique', type: 'ASSET' },
                ]
            },
            { code: '25', name: 'Matériel de transport', type: 'ASSET' },
            { code: '27', name: 'Dépôts et cautionnements', type: 'ASSET' },
            {
                code: '28', name: 'Amortissements des immobilisations', type: 'ASSET', children: [
                    { code: '281', name: 'Amort. immobilisations incorporelles', type: 'ASSET' },
                    { code: '282', name: 'Amort. constructions', type: 'ASSET' },
                    { code: '283', name: 'Amort. matériel et outillage', type: 'ASSET' },
                    { code: '284', name: 'Amort. matériel de transport', type: 'ASSET' },
                ]
            },
        ]
    },
    {
        code: '3', name: 'Stocks et En-cours', type: 'ASSET', children: [
            { code: '31', name: 'Marchandises', type: 'ASSET', subType: 'INVENTORY' },
            { code: '32', name: 'Matières premières', type: 'ASSET' },
            { code: '33', name: 'En-cours de production', type: 'ASSET' },
            { code: '35', name: 'Produits finis', type: 'ASSET' },
            { code: '37', name: 'Stocks en consignation', type: 'ASSET' },
            { code: '39', name: 'Provisions pour dépréciation des stocks', type: 'ASSET' },
        ]
    },
    {
        code: '4', name: 'Comptes de Tiers', type: 'LIABILITY', children: [
            {
                code: '40', name: 'Fournisseurs', type: 'LIABILITY', subType: 'PAYABLE', children: [
                    { code: '401', name: 'Fournisseurs locaux', type: 'LIABILITY' },
                    { code: '404', name: 'Fournisseurs étrangers', type: 'LIABILITY' },
                    { code: '408', name: 'Fournisseurs – factures non parvenues', type: 'LIABILITY' },
                ]
            },
            {
                code: '41', name: 'Clients (Créances)', type: 'ASSET', subType: 'RECEIVABLE', children: [
                    { code: '411', name: 'Clients locaux', type: 'ASSET' },
                    { code: '414', name: 'Clients étrangers', type: 'ASSET' },
                    { code: '416', name: 'Clients douteux', type: 'ASSET' },
                ]
            },
            {
                code: '42', name: 'Personnel et comptes rattachés', type: 'LIABILITY', children: [
                    { code: '421', name: 'Rémunérations dues', type: 'LIABILITY' },
                    { code: '425', name: 'Avances au personnel', type: 'ASSET' },
                ]
            },
            { code: '43', name: 'Organismes sociaux (CNSS)', type: 'LIABILITY' },
            {
                code: '44', name: 'État et collectivités publiques', type: 'LIABILITY', children: [
                    { code: '441', name: 'TVA collectée', type: 'LIABILITY' },
                    { code: '442', name: 'TVA déductible', type: 'ASSET' },
                    { code: '443', name: 'Impôt sur le revenu', type: 'LIABILITY' },
                    { code: '445', name: 'Impôt sur les sociétés', type: 'LIABILITY' },
                ]
            },
            { code: '46', name: 'Débiteurs et créditeurs divers', type: 'LIABILITY' },
            { code: '47', name: 'Comptes transitoires', type: 'LIABILITY' },
        ]
    },
    {
        code: '5', name: 'Comptes Financiers', type: 'ASSET', children: [
            {
                code: '51', name: 'Banques', type: 'ASSET', subType: 'BANK', children: [
                    { code: '511', name: 'Banque principale (LBP)', type: 'ASSET' },
                    { code: '512', name: 'Banque secondaire (USD)', type: 'ASSET' },
                ]
            },
            {
                code: '53', name: 'Caisse', type: 'ASSET', subType: 'CASH', children: [
                    { code: '531', name: 'Caisse locale', type: 'ASSET' },
                    { code: '532', name: 'Caisse devises', type: 'ASSET' },
                ]
            },
            { code: '58', name: 'Virements internes', type: 'ASSET' },
            { code: '59', name: 'Provisions pour dépréciation comptes financiers', type: 'ASSET' },
        ]
    },
    {
        code: '6', name: 'Comptes de Charges', type: 'EXPENSE', children: [
            {
                code: '60', name: 'Achats', type: 'EXPENSE', children: [
                    { code: '601', name: 'Achats de marchandises', type: 'EXPENSE' },
                    { code: '602', name: 'Achats de matières premières', type: 'EXPENSE' },
                    { code: '604', name: 'Achats d\'emballages', type: 'EXPENSE' },
                    { code: '607', name: 'Frais accessoires sur achats', type: 'EXPENSE' },
                ]
            },
            {
                code: '61', name: 'Services extérieurs', type: 'EXPENSE', children: [
                    { code: '611', name: 'Sous-traitance', type: 'EXPENSE' },
                    { code: '613', name: 'Loyers et charges locatives', type: 'EXPENSE' },
                    { code: '615', name: 'Entretien et réparations', type: 'EXPENSE' },
                    { code: '616', name: 'Assurances', type: 'EXPENSE' },
                ]
            },
            {
                code: '62', name: 'Autres services extérieurs', type: 'EXPENSE', children: [
                    { code: '621', name: 'Honoraires professionnels', type: 'EXPENSE' },
                    { code: '622', name: 'Publicité et marketing', type: 'EXPENSE' },
                    { code: '624', name: 'Transport et déplacements', type: 'EXPENSE' },
                    { code: '625', name: 'Télécommunications', type: 'EXPENSE' },
                    { code: '626', name: 'Frais bancaires', type: 'EXPENSE' },
                ]
            },
            {
                code: '63', name: 'Impôts et taxes', type: 'EXPENSE', children: [
                    { code: '631', name: 'Taxes municipales', type: 'EXPENSE' },
                    { code: '635', name: 'Droits d\'enregistrement', type: 'EXPENSE' },
                ]
            },
            {
                code: '64', name: 'Charges de personnel', type: 'EXPENSE', children: [
                    { code: '641', name: 'Salaires et appointements', type: 'EXPENSE' },
                    { code: '645', name: 'Charges sociales (CNSS)', type: 'EXPENSE' },
                    { code: '647', name: 'Indemnités de fin de service', type: 'EXPENSE' },
                ]
            },
            { code: '65', name: 'Autres charges opérationnelles', type: 'EXPENSE' },
            {
                code: '66', name: 'Charges financières', type: 'EXPENSE', children: [
                    { code: '661', name: 'Intérêts des emprunts', type: 'EXPENSE' },
                    { code: '665', name: 'Pertes de change', type: 'EXPENSE' },
                    { code: '666', name: 'Frais sur opérations bancaires', type: 'EXPENSE' },
                ]
            },
            { code: '67', name: 'Charges exceptionnelles', type: 'EXPENSE' },
            { code: '68', name: 'Dotations aux amortissements', type: 'EXPENSE' },
            { code: '69', name: 'Impôts sur les bénéfices', type: 'EXPENSE' },
        ]
    },
    {
        code: '7', name: 'Comptes de Produits', type: 'INCOME', children: [
            {
                code: '70', name: 'Ventes de marchandises', type: 'INCOME', children: [
                    { code: '701', name: 'Ventes de marchandises locales', type: 'INCOME' },
                    { code: '702', name: 'Ventes de marchandises export', type: 'INCOME' },
                ]
            },
            {
                code: '71', name: 'Production vendue', type: 'INCOME', children: [
                    { code: '711', name: 'Ventes de produits finis', type: 'INCOME' },
                    { code: '712', name: 'Prestations de services', type: 'INCOME' },
                ]
            },
            { code: '74', name: 'Subventions d\'exploitation', type: 'INCOME' },
            { code: '75', name: 'Autres produits opérationnels', type: 'INCOME' },
            {
                code: '76', name: 'Produits financiers', type: 'INCOME', children: [
                    { code: '761', name: 'Intérêts et produits assimilés', type: 'INCOME' },
                    { code: '765', name: 'Gains de change', type: 'INCOME' },
                ]
            },
            { code: '77', name: 'Produits exceptionnels', type: 'INCOME' },
            { code: '78', name: 'Reprises sur amortissements et provisions', type: 'INCOME' },
            { code: '79', name: 'Rabais, remises et ristournes obtenus', type: 'INCOME' },
        ]
    },
]

const FRENCH_PCG: TemplateAccount[] = [
    {
        code: '1', name: 'Comptes de capitaux', type: 'EQUITY', children: [
            {
                code: '10', name: 'Capital et réserves', type: 'EQUITY', children: [
                    { code: '101', name: 'Capital social ou individuel', type: 'EQUITY' },
                    { code: '104', name: 'Primes liées au capital', type: 'EQUITY' },
                    { code: '106', name: 'Réserves', type: 'EQUITY' },
                    { code: '108', name: 'Compte de l\'exploitant', type: 'EQUITY' },
                ]
            },
            { code: '11', name: 'Report à nouveau', type: 'EQUITY' },
            { code: '12', name: 'Résultat de l\'exercice', type: 'EQUITY' },
            { code: '13', name: 'Subventions d\'investissement', type: 'EQUITY' },
            {
                code: '15', name: 'Provisions', type: 'LIABILITY', children: [
                    { code: '151', name: 'Provisions pour risques', type: 'LIABILITY' },
                    { code: '155', name: 'Provisions pour impôts', type: 'LIABILITY' },
                    { code: '158', name: 'Autres provisions pour charges', type: 'LIABILITY' },
                ]
            },
            {
                code: '16', name: 'Emprunts et dettes assimilées', type: 'LIABILITY', children: [
                    { code: '163', name: 'Autres emprunts obligataires', type: 'LIABILITY' },
                    { code: '164', name: 'Emprunts auprès des établissements de crédit', type: 'LIABILITY' },
                    { code: '168', name: 'Autres emprunts et dettes assimilées', type: 'LIABILITY' },
                ]
            },
        ]
    },
    {
        code: '2', name: 'Comptes d\'immobilisations', type: 'ASSET', children: [
            {
                code: '20', name: 'Immobilisations incorporelles', type: 'ASSET', children: [
                    { code: '201', name: 'Frais d\'établissement', type: 'ASSET' },
                    { code: '205', name: 'Concessions, brevets, licences', type: 'ASSET' },
                    { code: '207', name: 'Fonds commercial', type: 'ASSET' },
                    { code: '208', name: 'Autres immobilisations incorporelles', type: 'ASSET' },
                ]
            },
            {
                code: '21', name: 'Immobilisations corporelles', type: 'ASSET', children: [
                    { code: '211', name: 'Terrains', type: 'ASSET' },
                    { code: '213', name: 'Constructions', type: 'ASSET' },
                    { code: '215', name: 'Installations techniques, matériel', type: 'ASSET' },
                    { code: '218', name: 'Autres immobilisations corporelles', type: 'ASSET' },
                ]
            },
            { code: '23', name: 'Immobilisations en cours', type: 'ASSET' },
            { code: '26', name: 'Participations et créances rattachées', type: 'ASSET' },
            {
                code: '27', name: 'Autres immobilisations financières', type: 'ASSET', children: [
                    { code: '271', name: 'Titres immobilisés', type: 'ASSET' },
                    { code: '275', name: 'Dépôts et cautionnements versés', type: 'ASSET' },
                ]
            },
            {
                code: '28', name: 'Amortissements des immobilisations', type: 'ASSET', children: [
                    { code: '280', name: 'Amort. immobilisations incorporelles', type: 'ASSET' },
                    { code: '281', name: 'Amort. immobilisations corporelles', type: 'ASSET' },
                ]
            },
            { code: '29', name: 'Dépréciations des immobilisations', type: 'ASSET' },
        ]
    },
    {
        code: '3', name: 'Comptes de stocks et en-cours', type: 'ASSET', children: [
            { code: '31', name: 'Matières premières', type: 'ASSET', subType: 'INVENTORY' },
            { code: '32', name: 'Autres approvisionnements', type: 'ASSET' },
            { code: '33', name: 'En-cours de production de biens', type: 'ASSET' },
            { code: '34', name: 'En-cours de production de services', type: 'ASSET' },
            { code: '35', name: 'Stocks de produits', type: 'ASSET' },
            { code: '37', name: 'Stocks de marchandises', type: 'ASSET', subType: 'INVENTORY' },
            { code: '39', name: 'Dépréciations des stocks', type: 'ASSET' },
        ]
    },
    {
        code: '4', name: 'Comptes de tiers', type: 'LIABILITY', children: [
            {
                code: '40', name: 'Fournisseurs et comptes rattachés', type: 'LIABILITY', subType: 'PAYABLE', children: [
                    { code: '401', name: 'Fournisseurs', type: 'LIABILITY' },
                    { code: '403', name: 'Fournisseurs – effets à payer', type: 'LIABILITY' },
                    { code: '408', name: 'Fournisseurs – factures non parvenues', type: 'LIABILITY' },
                    { code: '409', name: 'Fournisseurs débiteurs', type: 'ASSET' },
                ]
            },
            {
                code: '41', name: 'Clients et comptes rattachés', type: 'ASSET', subType: 'RECEIVABLE', children: [
                    { code: '411', name: 'Clients', type: 'ASSET' },
                    { code: '413', name: 'Clients – effets à recevoir', type: 'ASSET' },
                    { code: '416', name: 'Clients douteux ou litigieux', type: 'ASSET' },
                    { code: '418', name: 'Clients – produits non encore facturés', type: 'ASSET' },
                    { code: '419', name: 'Clients créditeurs (avances reçues)', type: 'LIABILITY' },
                ]
            },
            {
                code: '42', name: 'Personnel et comptes rattachés', type: 'LIABILITY', children: [
                    { code: '421', name: 'Personnel – rémunérations dues', type: 'LIABILITY' },
                    { code: '425', name: 'Personnel – avances et acomptes', type: 'ASSET' },
                    { code: '428', name: 'Personnel – charges à payer', type: 'LIABILITY' },
                ]
            },
            {
                code: '43', name: 'Sécurité sociale et organismes sociaux', type: 'LIABILITY', children: [
                    { code: '431', name: 'Sécurité sociale', type: 'LIABILITY' },
                    { code: '437', name: 'Autres organismes sociaux', type: 'LIABILITY' },
                ]
            },
            {
                code: '44', name: 'État et autres collectivités publiques', type: 'LIABILITY', children: [
                    { code: '4452', name: 'TVA due intracommunautaire', type: 'LIABILITY' },
                    { code: '4456', name: 'TVA déductible', type: 'ASSET' },
                    { code: '4457', name: 'TVA collectée', type: 'LIABILITY' },
                    { code: '4458', name: 'TVA à régulariser', type: 'LIABILITY' },
                    { code: '444', name: 'Impôts sur les bénéfices', type: 'LIABILITY' },
                ]
            },
            { code: '46', name: 'Débiteurs divers et créditeurs divers', type: 'LIABILITY' },
            { code: '47', name: 'Comptes transitoires ou d\'attente', type: 'LIABILITY' },
            { code: '49', name: 'Dépréciations des comptes de tiers', type: 'ASSET' },
        ]
    },
    {
        code: '5', name: 'Comptes financiers', type: 'ASSET', children: [
            {
                code: '51', name: 'Banques, établissements financiers', type: 'ASSET', subType: 'BANK', children: [
                    { code: '511', name: 'Valeurs à l\'encaissement', type: 'ASSET' },
                    { code: '512', name: 'Banques – comptes courants', type: 'ASSET' },
                ]
            },
            { code: '53', name: 'Caisse', type: 'ASSET', subType: 'CASH' },
            { code: '58', name: 'Virements internes', type: 'ASSET' },
            { code: '59', name: 'Dépréciations des comptes financiers', type: 'ASSET' },
        ]
    },
    {
        code: '6', name: 'Comptes de charges', type: 'EXPENSE', children: [
            {
                code: '60', name: 'Achats (sauf 603)', type: 'EXPENSE', children: [
                    { code: '601', name: 'Achats stockés – matières premières', type: 'EXPENSE' },
                    { code: '602', name: 'Achats stockés – autres approvisionnements', type: 'EXPENSE' },
                    { code: '606', name: 'Achats non stockés de matériels et fournitures', type: 'EXPENSE' },
                    { code: '607', name: 'Achats de marchandises', type: 'EXPENSE' },
                    { code: '609', name: 'Rabais, remises et ristournes obtenus sur achats', type: 'EXPENSE' },
                ]
            },
            {
                code: '61', name: 'Services extérieurs', type: 'EXPENSE', children: [
                    { code: '611', name: 'Sous-traitance générale', type: 'EXPENSE' },
                    { code: '613', name: 'Locations', type: 'EXPENSE' },
                    { code: '615', name: 'Entretien et réparations', type: 'EXPENSE' },
                    { code: '616', name: 'Primes d\'assurances', type: 'EXPENSE' },
                ]
            },
            {
                code: '62', name: 'Autres services extérieurs', type: 'EXPENSE', children: [
                    { code: '621', name: 'Personnel extérieur à l\'entreprise', type: 'EXPENSE' },
                    { code: '622', name: 'Rémunérations d\'intermédiaires et honoraires', type: 'EXPENSE' },
                    { code: '623', name: 'Publicité, publications, relations publiques', type: 'EXPENSE' },
                    { code: '625', name: 'Déplacements, missions et réceptions', type: 'EXPENSE' },
                    { code: '626', name: 'Frais postaux et de télécommunications', type: 'EXPENSE' },
                    { code: '627', name: 'Services bancaires et assimilés', type: 'EXPENSE' },
                ]
            },
            {
                code: '63', name: 'Impôts, taxes et versements assimilés', type: 'EXPENSE', children: [
                    { code: '631', name: 'Impôts, taxes sur rémunérations', type: 'EXPENSE' },
                    { code: '635', name: 'Autres impôts, taxes et versements', type: 'EXPENSE' },
                ]
            },
            {
                code: '64', name: 'Charges de personnel', type: 'EXPENSE', children: [
                    { code: '641', name: 'Rémunérations du personnel', type: 'EXPENSE' },
                    { code: '645', name: 'Charges de sécurité sociale et de prévoyance', type: 'EXPENSE' },
                    { code: '648', name: 'Autres charges de personnel', type: 'EXPENSE' },
                ]
            },
            { code: '65', name: 'Autres charges de gestion courante', type: 'EXPENSE' },
            {
                code: '66', name: 'Charges financières', type: 'EXPENSE', children: [
                    { code: '661', name: 'Charges d\'intérêts', type: 'EXPENSE' },
                    { code: '665', name: 'Escomptes accordés', type: 'EXPENSE' },
                    { code: '666', name: 'Pertes de change', type: 'EXPENSE' },
                ]
            },
            {
                code: '67', name: 'Charges exceptionnelles', type: 'EXPENSE', children: [
                    { code: '671', name: 'Charges exceptionnelles sur opérations de gestion', type: 'EXPENSE' },
                    { code: '675', name: 'Valeurs comptables des éléments d\'actif cédés', type: 'EXPENSE' },
                ]
            },
            {
                code: '68', name: 'Dotations aux amortissements, dépréciations et provisions', type: 'EXPENSE', children: [
                    { code: '681', name: 'Dotations aux amortissements et aux provisions – charges exploitation', type: 'EXPENSE' },
                    { code: '686', name: 'Dotations aux amortissements et provisions – charges financières', type: 'EXPENSE' },
                ]
            },
            {
                code: '69', name: 'Participation des salariés – Impôts sur les bénéfices', type: 'EXPENSE', children: [
                    { code: '691', name: 'Participation des salariés', type: 'EXPENSE' },
                    { code: '695', name: 'Impôts sur les bénéfices', type: 'EXPENSE' },
                ]
            },
        ]
    },
    {
        code: '7', name: 'Comptes de produits', type: 'INCOME', children: [
            {
                code: '70', name: 'Ventes de produits fabriqués, prestations de services, marchandises', type: 'INCOME', children: [
                    { code: '701', name: 'Ventes de produits finis', type: 'INCOME' },
                    { code: '706', name: 'Prestations de services', type: 'INCOME' },
                    { code: '707', name: 'Ventes de marchandises', type: 'INCOME' },
                    { code: '708', name: 'Produits des activités annexes', type: 'INCOME' },
                    { code: '709', name: 'Rabais, remises et ristournes accordés', type: 'INCOME' },
                ]
            },
            { code: '71', name: 'Production stockée (ou déstockage)', type: 'INCOME' },
            { code: '72', name: 'Production immobilisée', type: 'INCOME' },
            { code: '74', name: 'Subventions d\'exploitation', type: 'INCOME' },
            { code: '75', name: 'Autres produits de gestion courante', type: 'INCOME' },
            {
                code: '76', name: 'Produits financiers', type: 'INCOME', children: [
                    { code: '761', name: 'Produits de participations', type: 'INCOME' },
                    { code: '765', name: 'Escomptes obtenus', type: 'INCOME' },
                    { code: '766', name: 'Gains de change', type: 'INCOME' },
                ]
            },
            {
                code: '77', name: 'Produits exceptionnels', type: 'INCOME', children: [
                    { code: '771', name: 'Produits exceptionnels sur opérations de gestion', type: 'INCOME' },
                    { code: '775', name: 'Produits des cessions d\'éléments d\'actif', type: 'INCOME' },
                ]
            },
            { code: '78', name: 'Reprises sur amortissements, dépréciations et provisions', type: 'INCOME' },
            { code: '79', name: 'Transferts de charges', type: 'INCOME' },
        ]
    },
]

const USA_GAAP: TemplateAccount[] = [
    {
        code: '1000', name: 'Assets', type: 'ASSET', children: [
            {
                code: '1100', name: 'Current Assets', type: 'ASSET', children: [
                    {
                        code: '1110', name: 'Cash and Cash Equivalents', type: 'ASSET', subType: 'CASH', children: [
                            { code: '1111', name: 'Operating Cash Account', type: 'ASSET', subType: 'BANK' },
                            { code: '1112', name: 'Petty Cash', type: 'ASSET', subType: 'CASH' },
                            { code: '1113', name: 'Savings Account', type: 'ASSET', subType: 'BANK' },
                        ]
                    },
                    { code: '1120', name: 'Accounts Receivable', type: 'ASSET', subType: 'RECEIVABLE' },
                    { code: '1125', name: 'Allowance for Doubtful Accounts (CONTRA)', type: 'ASSET' },
                    { code: '1130', name: 'Notes Receivable', type: 'ASSET' },
                    {
                        code: '1140', name: 'Inventory', type: 'ASSET', subType: 'INVENTORY', children: [
                            { code: '1141', name: 'Raw Materials', type: 'ASSET' },
                            { code: '1142', name: 'Work in Process', type: 'ASSET' },
                            { code: '1143', name: 'Finished Goods', type: 'ASSET' },
                            { code: '1144', name: 'Merchandise Inventory', type: 'ASSET' },
                        ]
                    },
                    {
                        code: '1150', name: 'Prepaid Expenses', type: 'ASSET', children: [
                            { code: '1151', name: 'Prepaid Insurance', type: 'ASSET' },
                            { code: '1152', name: 'Prepaid Rent', type: 'ASSET' },
                        ]
                    },
                    { code: '1160', name: 'Short-Term Investments', type: 'ASSET' },
                    { code: '1170', name: 'Employee Advances', type: 'ASSET' },
                ]
            },
            {
                code: '1500', name: 'Non-Current Assets (PP&E)', type: 'ASSET', children: [
                    { code: '1510', name: 'Land', type: 'ASSET' },
                    { code: '1520', name: 'Buildings', type: 'ASSET' },
                    { code: '1530', name: 'Machinery & Equipment', type: 'ASSET' },
                    { code: '1540', name: 'Furniture & Fixtures', type: 'ASSET' },
                    { code: '1550', name: 'Vehicles', type: 'ASSET' },
                    { code: '1560', name: 'Leasehold Improvements', type: 'ASSET' },
                    { code: '1570', name: 'Computer Equipment', type: 'ASSET' },
                ]
            },
            {
                code: '1600', name: 'Accumulated Depreciation (CONTRA)', type: 'ASSET', children: [
                    { code: '1610', name: 'Accum. Depr. – Buildings', type: 'ASSET' },
                    { code: '1620', name: 'Accum. Depr. – Equipment', type: 'ASSET' },
                    { code: '1630', name: 'Accum. Depr. – Vehicles', type: 'ASSET' },
                    { code: '1640', name: 'Accum. Depr. – Furniture', type: 'ASSET' },
                ]
            },
            {
                code: '1700', name: 'Intangible Assets', type: 'ASSET', children: [
                    { code: '1710', name: 'Goodwill', type: 'ASSET' },
                    { code: '1720', name: 'Patents & Trademarks', type: 'ASSET' },
                    { code: '1730', name: 'Software', type: 'ASSET' },
                ]
            },
            {
                code: '1800', name: 'Other Assets', type: 'ASSET', children: [
                    { code: '1810', name: 'Security Deposits', type: 'ASSET' },
                    { code: '1820', name: 'Long-Term Investments', type: 'ASSET' },
                ]
            },
        ]
    },
    {
        code: '2000', name: 'Liabilities', type: 'LIABILITY', children: [
            {
                code: '2100', name: 'Current Liabilities', type: 'LIABILITY', children: [
                    { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', subType: 'PAYABLE' },
                    { code: '2120', name: 'Accrued Expenses', type: 'LIABILITY' },
                    { code: '2130', name: 'Unearned Revenue', type: 'LIABILITY' },
                    { code: '2140', name: 'Sales Tax Payable', type: 'LIABILITY' },
                    {
                        code: '2150', name: 'Payroll Liabilities', type: 'LIABILITY', children: [
                            { code: '2151', name: 'Federal Income Tax Withholding', type: 'LIABILITY' },
                            { code: '2152', name: 'State Income Tax Withholding', type: 'LIABILITY' },
                            { code: '2153', name: 'FICA Payable', type: 'LIABILITY' },
                            { code: '2154', name: 'Health Insurance Payable', type: 'LIABILITY' },
                        ]
                    },
                    { code: '2160', name: 'Current Portion of Long-Term Debt', type: 'LIABILITY' },
                    { code: '2170', name: 'Credit Card Payable', type: 'LIABILITY' },
                    { code: '2180', name: 'Notes Payable (Short-Term)', type: 'LIABILITY' },
                ]
            },
            {
                code: '2500', name: 'Long-Term Liabilities', type: 'LIABILITY', children: [
                    { code: '2510', name: 'Notes Payable (Long-Term)', type: 'LIABILITY' },
                    { code: '2520', name: 'Mortgage Payable', type: 'LIABILITY' },
                    { code: '2530', name: 'Bonds Payable', type: 'LIABILITY' },
                    { code: '2540', name: 'Lease Obligations (ASC 842)', type: 'LIABILITY' },
                ]
            },
        ]
    },
    {
        code: '3000', name: 'Equity', type: 'EQUITY', children: [
            { code: '3100', name: 'Common Stock', type: 'EQUITY' },
            { code: '3110', name: 'Preferred Stock', type: 'EQUITY' },
            { code: '3200', name: 'Additional Paid-In Capital', type: 'EQUITY' },
            { code: '3300', name: 'Retained Earnings', type: 'EQUITY' },
            { code: '3400', name: 'Treasury Stock (CONTRA)', type: 'EQUITY' },
            { code: '3500', name: 'Owner\'s Draws / Distributions', type: 'EQUITY' },
            { code: '3600', name: 'Accumulated Other Comprehensive Income', type: 'EQUITY' },
        ]
    },
    {
        code: '4000', name: 'Revenue', type: 'INCOME', children: [
            {
                code: '4100', name: 'Sales Revenue', type: 'INCOME', children: [
                    { code: '4110', name: 'Product Sales', type: 'INCOME' },
                    { code: '4120', name: 'Service Revenue', type: 'INCOME' },
                    { code: '4130', name: 'Sales Returns & Allowances (CONTRA)', type: 'INCOME' },
                    { code: '4140', name: 'Sales Discounts (CONTRA)', type: 'INCOME' },
                ]
            },
            { code: '4500', name: 'Other Operating Revenue', type: 'INCOME' },
        ]
    },
    {
        code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', children: [
            { code: '5100', name: 'Cost of Materials', type: 'EXPENSE' },
            { code: '5200', name: 'Direct Labor', type: 'EXPENSE' },
            { code: '5300', name: 'Manufacturing Overhead', type: 'EXPENSE' },
            { code: '5400', name: 'Freight-In', type: 'EXPENSE' },
            { code: '5500', name: 'Purchase Discounts (CONTRA)', type: 'EXPENSE' },
        ]
    },
    {
        code: '6000', name: 'Operating Expenses', type: 'EXPENSE', children: [
            {
                code: '6100', name: 'Payroll Expense', type: 'EXPENSE', children: [
                    { code: '6110', name: 'Salaries & Wages', type: 'EXPENSE' },
                    { code: '6120', name: 'Payroll Tax Expense', type: 'EXPENSE' },
                    { code: '6130', name: 'Employee Benefits', type: 'EXPENSE' },
                    { code: '6140', name: 'Workers\' Compensation', type: 'EXPENSE' },
                ]
            },
            { code: '6200', name: 'Rent Expense', type: 'EXPENSE' },
            { code: '6210', name: 'Utilities', type: 'EXPENSE' },
            { code: '6220', name: 'Insurance Expense', type: 'EXPENSE' },
            { code: '6230', name: 'Repairs & Maintenance', type: 'EXPENSE' },
            { code: '6240', name: 'Office Supplies', type: 'EXPENSE' },
            { code: '6250', name: 'Telephone & Internet', type: 'EXPENSE' },
            { code: '6260', name: 'Advertising & Marketing', type: 'EXPENSE' },
            { code: '6270', name: 'Travel & Entertainment', type: 'EXPENSE' },
            { code: '6280', name: 'Professional Fees (Legal, Accounting)', type: 'EXPENSE' },
            { code: '6290', name: 'Bank Charges & Fees', type: 'EXPENSE' },
            { code: '6300', name: 'Depreciation Expense', type: 'EXPENSE' },
            { code: '6310', name: 'Amortization Expense', type: 'EXPENSE' },
            { code: '6320', name: 'Bad Debt Expense', type: 'EXPENSE' },
            { code: '6400', name: 'Miscellaneous Expense', type: 'EXPENSE' },
        ]
    },
    {
        code: '7000', name: 'Other Income & Expense', type: 'INCOME', children: [
            { code: '7100', name: 'Interest Income', type: 'INCOME' },
            { code: '7200', name: 'Interest Expense', type: 'EXPENSE' },
            { code: '7300', name: 'Gain on Sale of Assets', type: 'INCOME' },
            { code: '7400', name: 'Loss on Sale of Assets', type: 'EXPENSE' },
            { code: '7500', name: 'Foreign Exchange Gain/Loss', type: 'INCOME' },
        ]
    },
    {
        code: '8000', name: 'Income Tax', type: 'EXPENSE', children: [
            { code: '8100', name: 'Federal Income Tax Expense', type: 'EXPENSE' },
            { code: '8200', name: 'State Income Tax Expense', type: 'EXPENSE' },
        ]
    },
]

const IFRS_COA: TemplateAccount[] = [
    {
        code: '1000', name: 'ASSETS', type: 'ASSET', children: [
            {
                code: '1100', name: 'Current Assets', type: 'ASSET', children: [
                    {
                        code: '1101', name: 'Cash & Cash Equivalents', type: 'ASSET', children: [
                            { code: '1101.01', name: 'Cash in Hand', type: 'ASSET', subType: 'CASH', syscohadaCode: '57', syscohadaClass: 'Class 5' },
                            { code: '1101.02', name: 'Cash Register (POS)', type: 'ASSET', subType: 'CASH', syscohadaCode: '57', syscohadaClass: 'Class 5' },
                            { code: '1101.03', name: 'Main Bank Account', type: 'ASSET', subType: 'BANK', syscohadaCode: '52', syscohadaClass: 'Class 5' },
                        ]
                    },
                    { code: '1110', name: 'Accounts Receivable', type: 'ASSET', subType: 'RECEIVABLE', syscohadaCode: '41', syscohadaClass: 'Class 4' },
                    {
                        code: '1120', name: 'Inventory', type: 'ASSET', syscohadaCode: '31', syscohadaClass: 'Class 3', children: [
                            { code: '1121', name: 'Raw Materials', type: 'ASSET', subType: 'INVENTORY', syscohadaCode: '31', syscohadaClass: 'Class 3' },
                            { code: '1122', name: 'Finished Goods', type: 'ASSET', subType: 'INVENTORY', syscohadaCode: '31', syscohadaClass: 'Class 3' },
                            { code: '1123', name: 'Work in Progress', type: 'ASSET', subType: 'INVENTORY', syscohadaCode: '31', syscohadaClass: 'Class 3' },
                            { code: '1124', name: 'Goods in Transit', type: 'ASSET', subType: 'INVENTORY', syscohadaCode: '31', syscohadaClass: 'Class 3' },
                        ]
                    },
                    {
                        code: '1130', name: 'Prepaid Expenses', type: 'ASSET', syscohadaCode: '47', syscohadaClass: 'Class 4', children: [
                            { code: '1131', name: 'Prepaid Insurance', type: 'ASSET', syscohadaCode: '47', syscohadaClass: 'Class 4' },
                            { code: '1132', name: 'Prepaid Rent', type: 'ASSET', syscohadaCode: '47', syscohadaClass: 'Class 4' },
                        ]
                    },
                    { code: '1140', name: 'Employee Advances', type: 'ASSET', subType: 'RECEIVABLE', syscohadaCode: '42', syscohadaClass: 'Class 4' },
                    { code: '1150', name: 'Deposits & Guarantees', type: 'ASSET', syscohadaCode: '27', syscohadaClass: 'Class 2' },
                    { code: '1160', name: 'Short-Term Investments', type: 'ASSET', syscohadaCode: '50', syscohadaClass: 'Class 5' },
                ]
            },
            {
                code: '1200', name: 'Non-Current Assets', type: 'ASSET', children: [
                    { code: '1201', name: 'Land', type: 'ASSET', syscohadaCode: '21', syscohadaClass: 'Class 2' },
                    { code: '1202', name: 'Buildings', type: 'ASSET', syscohadaCode: '23', syscohadaClass: 'Class 2' },
                    { code: '1203', name: 'Furniture & Fixtures', type: 'ASSET', syscohadaCode: '24', syscohadaClass: 'Class 2' },
                    { code: '1204', name: 'Equipment', type: 'ASSET', syscohadaCode: '24', syscohadaClass: 'Class 2' },
                    { code: '1205', name: 'Vehicles', type: 'ASSET', syscohadaCode: '25', syscohadaClass: 'Class 2' },
                    { code: '1206', name: 'Software / Intangible Assets', type: 'ASSET', syscohadaCode: '21', syscohadaClass: 'Class 2' },
                    { code: '1207', name: 'Leasehold Improvements', type: 'ASSET', syscohadaCode: '23', syscohadaClass: 'Class 2' },
                ]
            },
            {
                code: '1210', name: 'Accumulated Depreciation (CONTRA-ASSET)', type: 'ASSET', children: [
                    { code: '1211', name: 'Accumulated Depreciation – Equipment', type: 'ASSET', syscohadaCode: '28', syscohadaClass: 'Class 2' },
                    { code: '1212', name: 'Accumulated Depreciation – Vehicles', type: 'ASSET', syscohadaCode: '28', syscohadaClass: 'Class 2' },
                    { code: '1213', name: 'Accumulated Amortization – Software', type: 'ASSET', syscohadaCode: '28', syscohadaClass: 'Class 2' },
                ]
            }
        ]
    },
    {
        code: '2000', name: 'LIABILITIES', type: 'LIABILITY', children: [
            {
                code: '2100', name: 'Current Liabilities', type: 'LIABILITY', children: [
                    { code: '2101', name: 'Accounts Payable', type: 'LIABILITY', subType: 'PAYABLE', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                    { code: '2102', name: 'Accrued Liabilities', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                    { code: '2103', name: 'Customer Deposits', type: 'LIABILITY', syscohadaCode: '41', syscohadaClass: 'Class 4' },
                    { code: '2104', name: 'Goods Received Not Invoiced', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                    {
                        code: '2110', name: 'Taxes Payable', type: 'LIABILITY', children: [
                            { code: '2111', name: 'VAT Payable', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2112', name: 'Income Tax Payable', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2113', name: 'Payroll Tax Payable', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2114', name: 'Reverse Charge VAT', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2115', name: 'VAT Refund Receivable', type: 'ASSET', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2116', name: 'VAT Suspense (Cash-Basis)', type: 'LIABILITY', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2117', name: 'VAT Collected (Output)', type: 'LIABILITY', subType: 'TAX', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2118', name: 'VAT Deductible (Input)', type: 'ASSET', subType: 'TAX', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                            { code: '2119', name: 'Withholding Tax – AIRSI', type: 'LIABILITY', subType: 'TAX', syscohadaCode: '44', syscohadaClass: 'Class 4' },
                        ]
                    },
                    {
                        code: '2120', name: 'Accrued Expenses', type: 'LIABILITY', children: [
                            { code: '2121', name: 'Salaries Payable', type: 'LIABILITY', syscohadaCode: '42', syscohadaClass: 'Class 4' },
                            { code: '2122', name: 'Rent Payable', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                            { code: '2123', name: 'Utilities Payable', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                            { code: '2124', name: 'Accrued Interest', type: 'LIABILITY', syscohadaCode: '40', syscohadaClass: 'Class 4' },
                        ]
                    },
                    { code: '2130', name: 'Deferred Revenue', type: 'LIABILITY', syscohadaCode: '47', syscohadaClass: 'Class 4' }
                ]
            },
            {
                code: '2200', name: 'Long-Term Liabilities', type: 'LIABILITY', children: [
                    { code: '2201', name: 'Bank Loan', type: 'LIABILITY', syscohadaCode: '16', syscohadaClass: 'Class 1' },
                    { code: '2202', name: 'Lease Liability', type: 'LIABILITY', syscohadaCode: '16', syscohadaClass: 'Class 1' },
                ]
            }
        ]
    },
    {
        code: '3000', name: 'EQUITY', type: 'EQUITY', children: [
            { code: '3001', name: 'Owner Capital', type: 'EQUITY', syscohadaCode: '10', syscohadaClass: 'Class 1' },
            { code: '3002', name: 'Additional Capital', type: 'EQUITY', syscohadaCode: '10', syscohadaClass: 'Class 1' },
            { code: '3003', name: 'Retained Earnings', type: 'EQUITY', syscohadaCode: '11', syscohadaClass: 'Class 1' },
            { code: '3004', name: 'Current Year Profit / Loss', type: 'EQUITY', syscohadaCode: '13', syscohadaClass: 'Class 1' },
            { code: '3005', name: 'Owner Draws / Withdrawals', type: 'EQUITY', syscohadaCode: '10', syscohadaClass: 'Class 1' },
            { code: '3006', name: 'Reserves', type: 'EQUITY', syscohadaCode: '11', syscohadaClass: 'Class 1' },
        ]
    },
    {
        code: '4000', name: 'REVENUE', type: 'INCOME', children: [
            {
                code: '4100', name: 'Sales Revenue', type: 'INCOME', children: [
                    { code: '4101', name: 'Sales – Cash', type: 'INCOME', syscohadaCode: '70', syscohadaClass: 'Class 7' },
                    { code: '4102', name: 'Sales – Credit', type: 'INCOME', syscohadaCode: '70', syscohadaClass: 'Class 7' },
                    { code: '4103', name: 'Sales – Online', type: 'INCOME', syscohadaCode: '70', syscohadaClass: 'Class 7' },
                    { code: '4104', name: 'Sales Returns & Allowances', type: 'INCOME', syscohadaCode: '70', syscohadaClass: 'Class 7' },
                ]
            },
            {
                code: '4200', name: 'Other Income', type: 'INCOME', children: [
                    { code: '4201', name: 'Discount Received', type: 'INCOME', syscohadaCode: '77', syscohadaClass: 'Class 7' },
                    { code: '4202', name: 'Interest Income', type: 'INCOME', syscohadaCode: '77', syscohadaClass: 'Class 7' },
                    { code: '4203', name: 'Inventory Adjustment Gain', type: 'INCOME', syscohadaCode: '75', syscohadaClass: 'Class 7' },
                    { code: '4204', name: 'Foreign Exchange Gain', type: 'INCOME', syscohadaCode: '76', syscohadaClass: 'Class 7' },
                    { code: '4205', name: 'Commission Income', type: 'INCOME', syscohadaCode: '75', syscohadaClass: 'Class 7' },
                ]
            }
        ]
    },
    {
        code: '5000', name: 'COST OF GOODS SOLD (COGS)', type: 'EXPENSE', children: [
            {
                code: '5100', name: 'Cost of Sales', type: 'EXPENSE', children: [
                    { code: '5101', name: 'Cost of Goods Purchased', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '5102', name: 'Freight In', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '5103', name: 'Import Duties', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '5104', name: 'Inventory Adjustment', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '5105', name: 'Packaging & Materials', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                ]
            }
        ]
    },
    {
        code: '6000', name: 'OPERATING EXPENSES', type: 'EXPENSE', children: [
            {
                code: '6100', name: 'Operating Expenses', type: 'EXPENSE', children: [
                    { code: '6101', name: 'Salaries & Wages', type: 'EXPENSE', syscohadaCode: '64', syscohadaClass: 'Class 6' },
                    { code: '6102', name: 'Transport Allowance', type: 'EXPENSE', syscohadaCode: '64', syscohadaClass: 'Class 6' },
                    { code: '6103', name: 'Rent Expense', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6104', name: 'Utilities Expense', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6105', name: 'Internet & Phone', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6106', name: 'Maintenance', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6107', name: 'Cleaning', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6108', name: 'Security', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                ]
            },
            {
                code: '6200', name: 'Administrative Expenses', type: 'EXPENSE', children: [
                    { code: '6201', name: 'Office Supplies', type: 'EXPENSE', syscohadaCode: '60', syscohadaClass: 'Class 6' },
                    { code: '6202', name: 'Software / POS Subscription', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6203', name: 'Professional Fees', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6204', name: 'Travel & Entertainment', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6205', name: 'Marketing & Advertising', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                    { code: '6206', name: 'Legal Fees', type: 'EXPENSE', syscohadaCode: '62', syscohadaClass: 'Class 6' },
                ]
            },
            {
                code: '6300', name: 'Financial Expenses', type: 'EXPENSE', children: [
                    { code: '6301', name: 'Bank Charges', type: 'EXPENSE', syscohadaCode: '67', syscohadaClass: 'Class 6' },
                    { code: '6302', name: 'Interest Expense', type: 'EXPENSE', syscohadaCode: '67', syscohadaClass: 'Class 6' },
                    { code: '6303', name: 'Depreciation & Amortization Expense', type: 'EXPENSE', syscohadaCode: '68', syscohadaClass: 'Class 6' },
                    { code: '6304', name: 'Bad Debt Expense', type: 'EXPENSE', syscohadaCode: '65', syscohadaClass: 'Class 6' },
                    { code: '6305', name: 'Foreign Exchange Loss', type: 'EXPENSE', syscohadaCode: '66', syscohadaClass: 'Class 6' },
                    { code: '6306', name: 'Discount Given', type: 'EXPENSE', syscohadaCode: '65', syscohadaClass: 'Class 6' },
                ]
            }
        ]
    },
    {
        code: '9000', name: 'SYSTEM & CLEARING ACCOUNTS', type: 'EXPENSE', children: [
            {
                code: '9001', name: 'Stock Adjustment Control', type: 'EXPENSE',
                syscohadaCode: '60', syscohadaClass: 'Class 6',
                isSystemOnly: true, isHidden: true, requiresZeroBalance: true
            },
            {
                code: '9002', name: 'POS Rounding Difference', type: 'INCOME',
                syscohadaCode: '77', syscohadaClass: 'Class 7',
                isSystemOnly: true, isHidden: true
            },
            {
                code: '9003', name: 'Exchange Difference', type: 'INCOME',
                syscohadaCode: '76', syscohadaClass: 'Class 7',
                isSystemOnly: true, isHidden: true
            },
        ]
    }
]

const SYSCOHADA_REVISED: TemplateAccount[] = [
    {
        code: "1", name: "Comptes de ressources durables", type: "EQUITY", children: [
            {
                code: "10", name: "Capital", type: "EQUITY", children: [
                    { code: "101", name: "Capital social", type: "EQUITY" },
                    { code: "105", name: "Primes liées au capital social", type: "EQUITY" },
                    { code: "109", name: "Actionnaires, capital souscrit non appelé", type: "EQUITY" },
                ]
            },
            {
                code: "11", name: "Réserves", type: "EQUITY", children: [
                    { code: "111", name: "Réserve légale", type: "EQUITY" },
                    { code: "112", name: "Réserves statutaires ou contractuelles", type: "EQUITY" },
                    { code: "118", name: "Autres réserves", type: "EQUITY" },
                ]
            },
            { code: "12", name: "Report à nouveau", type: "EQUITY" },
            { code: "13", name: "Résultat net de l'exercice", type: "EQUITY" },
            { code: "14", name: "Subventions d'investissement", type: "EQUITY" },
            { code: "15", name: "Provisions réglementées et fonds assimilés", type: "LIABILITY" },
            {
                code: "16", name: "Emprunts et dettes assimilées", type: "LIABILITY", children: [
                    { code: "161", name: "Emprunts obligataires", type: "LIABILITY" },
                    { code: "162", name: "Emprunts et dettes auprès des établissements de crédit", type: "LIABILITY" },
                    { code: "165", name: "Dépôts et cautionnements reçus", type: "LIABILITY" },
                ]
            },
            { code: "17", name: "Dettes de crédit-bail et contrats assimilés", type: "LIABILITY" },
            {
                code: "19", name: "Provisions financières pour risques et charges", type: "LIABILITY", children: [
                    { code: "191", name: "Provisions pour litiges", type: "LIABILITY" },
                    { code: "194", name: "Provisions pour pertes de change", type: "LIABILITY" },
                    { code: "195", name: "Provisions pour impôts", type: "LIABILITY" },
                ]
            },
        ]
    },
    {
        code: "2", name: "Comptes d'actif immobilisé", type: "ASSET", children: [
            {
                code: "21", name: "Immobilisations incorporelles", type: "ASSET", children: [
                    { code: "211", name: "Frais de développement", type: "ASSET" },
                    { code: "212", name: "Brevets, licences, logiciels", type: "ASSET" },
                    { code: "213", name: "Fonds commercial et droit au bail", type: "ASSET" },
                ]
            },
            { code: "22", name: "Terrains", type: "ASSET" },
            {
                code: "23", name: "Bâtiments, installations techniques et agencements", type: "ASSET", children: [
                    { code: "231", name: "Bâtiments", type: "ASSET" },
                    { code: "232", name: "Installations techniques", type: "ASSET" },
                    { code: "233", name: "Agencements et aménagements", type: "ASSET" },
                ]
            },
            {
                code: "24", name: "Matériel", type: "ASSET", children: [
                    { code: "241", name: "Matériel et outillage industriel", type: "ASSET" },
                    { code: "244", name: "Matériel et mobilier de bureau", type: "ASSET" },
                    { code: "245", name: "Matériel informatique", type: "ASSET" },
                ]
            },
            { code: "25", name: "Matériel de transport", type: "ASSET" },
            {
                code: "27", name: "Autres immobilisations financières", type: "ASSET", children: [
                    { code: "271", name: "Prêts et créances non commerciales", type: "ASSET" },
                    { code: "275", name: "Dépôts et cautionnements versés", type: "ASSET" },
                ]
            },
            {
                code: "28", name: "Amortissements", type: "ASSET", children: [
                    { code: "281", name: "Amortissements des immobilisations incorporelles", type: "ASSET" },
                    { code: "283", name: "Amortissements des bâtiments", type: "ASSET" },
                    { code: "284", name: "Amortissements du matériel", type: "ASSET" },
                    { code: "285", name: "Amortissements du matériel de transport", type: "ASSET" },
                ]
            },
            { code: "29", name: "Provisions pour dépréciation", type: "ASSET" },
        ]
    },
    {
        code: "3", name: "Comptes de stocks", type: "ASSET", children: [
            { code: "31", name: "Marchandises", type: "ASSET", subType: "INVENTORY" },
            { code: "32", name: "Matières premières et fournitures liées", type: "ASSET" },
            { code: "33", name: "Autres approvisionnements", type: "ASSET" },
            { code: "34", name: "Produits en cours", type: "ASSET" },
            { code: "35", name: "Services en cours", type: "ASSET" },
            { code: "36", name: "Produits finis", type: "ASSET" },
            { code: "37", name: "Produits intermédiaires et résiduels", type: "ASSET" },
            { code: "39", name: "Dépréciations des stocks", type: "ASSET" },
        ]
    },
    {
        code: "4", name: "Comptes de tiers", type: "ASSET", children: [
            {
                code: "40", name: "Fournisseurs et comptes rattachés", type: "LIABILITY", subType: "PAYABLE", children: [
                    { code: "401", name: "Fournisseurs, dettes en compte", type: "LIABILITY" },
                    { code: "402", name: "Fournisseurs, effets à payer", type: "LIABILITY" },
                    { code: "408", name: "Fournisseurs, factures non parvenues", type: "LIABILITY" },
                    { code: "409", name: "Fournisseurs débiteurs", type: "ASSET" },
                ]
            },
            {
                code: "41", name: "Clients et comptes rattachés", type: "ASSET", subType: "RECEIVABLE", children: [
                    { code: "411", name: "Clients", type: "ASSET" },
                    { code: "412", name: "Clients, effets à recevoir", type: "ASSET" },
                    { code: "416", name: "Créances clients litigieuses", type: "ASSET" },
                    { code: "419", name: "Clients créditeurs (avances reçues)", type: "LIABILITY" },
                ]
            },
            {
                code: "42", name: "Personnel", type: "LIABILITY", children: [
                    { code: "421", name: "Personnel, rémunérations dues", type: "LIABILITY" },
                    { code: "422", name: "Personnel, avances et acomptes", type: "ASSET" },
                ]
            },
            { code: "43", name: "Organismes sociaux", type: "LIABILITY" },
            {
                code: "44", name: "État et collectivités publiques", type: "LIABILITY", children: [
                    { code: "441", name: "État, impôts sur les bénéfices", type: "LIABILITY" },
                    { code: "443", name: "État, TVA facturée", type: "LIABILITY" },
                    { code: "445", name: "État, TVA récupérable", type: "ASSET" },
                    { code: "447", name: "État, impôts retenus à la source", type: "LIABILITY" },
                    { code: "449", name: "État, créances et dettes diverses", type: "LIABILITY" },
                ]
            },
            { code: "46", name: "Débiteurs et créditeurs divers", type: "LIABILITY" },
            { code: "47", name: "Débiteurs et créditeurs divers – Compte d'attente", type: "LIABILITY" },
            { code: "48", name: "Créances et dettes hors activités ordinaires (HAO)", type: "LIABILITY" },
            { code: "49", name: "Dépréciations et risques provisionnés (Tiers)", type: "ASSET" },
        ]
    },
    {
        code: "5", name: "Comptes de trésorerie", type: "ASSET", children: [
            {
                code: "52", name: "Banques", type: "ASSET", subType: "BANK", children: [
                    { code: "521", name: "Banques locales", type: "ASSET" },
                    { code: "522", name: "Banques autres États OHADA", type: "ASSET" },
                    { code: "524", name: "Banques hors zone OHADA", type: "ASSET" },
                ]
            },
            { code: "53", name: "Établissements financiers et assimilés", type: "ASSET" },
            { code: "56", name: "Banques, crédits de trésorerie et d'escompte", type: "LIABILITY" },
            {
                code: "57", name: "Caisse", type: "ASSET", subType: "CASH", children: [
                    { code: "571", name: "Caisse siège social", type: "ASSET" },
                    { code: "572", name: "Caisse succursale", type: "ASSET" },
                ]
            },
            { code: "58", name: "Régies d'avances, accréditifs et virements internes", type: "ASSET" },
            { code: "59", name: "Dépréciations de trésorerie", type: "ASSET" },
        ]
    },
    {
        code: "6", name: "Comptes de charges des activités ordinaires", type: "EXPENSE", children: [
            {
                code: "60", name: "Achats et variations de stocks", type: "EXPENSE", children: [
                    { code: "601", name: "Achats de marchandises", type: "EXPENSE" },
                    { code: "602", name: "Achats de matières premières", type: "EXPENSE" },
                    { code: "604", name: "Achats stockés de matières et fournitures consommables", type: "EXPENSE" },
                    { code: "605", name: "Autres achats", type: "EXPENSE" },
                    { code: "608", name: "Frais accessoires d'achats", type: "EXPENSE" },
                ]
            },
            {
                code: "61", name: "Transports", type: "EXPENSE", children: [
                    { code: "611", name: "Transports sur achats", type: "EXPENSE" },
                    { code: "612", name: "Transports sur ventes", type: "EXPENSE" },
                    { code: "613", name: "Transports pour le compte de tiers", type: "EXPENSE" },
                ]
            },
            {
                code: "62", name: "Services extérieurs A", type: "EXPENSE", children: [
                    { code: "621", name: "Sous-traitance générale", type: "EXPENSE" },
                    { code: "622", name: "Locations et charges locatives", type: "EXPENSE" },
                    { code: "623", name: "Redevances de crédit-bail", type: "EXPENSE" },
                    { code: "624", name: "Entretien, réparations et maintenance", type: "EXPENSE" },
                    { code: "625", name: "Primes d'assurance", type: "EXPENSE" },
                ]
            },
            {
                code: "63", name: "Services extérieurs B", type: "EXPENSE", children: [
                    { code: "631", name: "Frais bancaires", type: "EXPENSE" },
                    { code: "632", name: "Rémunérations d'intermédiaires et de conseils", type: "EXPENSE" },
                    { code: "633", name: "Frais de formation du personnel", type: "EXPENSE" },
                    { code: "634", name: "Publicité et publications", type: "EXPENSE" },
                    { code: "635", name: "Frais de télécommunications", type: "EXPENSE" },
                    { code: "638", name: "Autres charges externes", type: "EXPENSE" },
                ]
            },
            {
                code: "64", name: "Impôts et taxes", type: "EXPENSE", children: [
                    { code: "641", name: "Impôts et taxes directs", type: "EXPENSE" },
                    { code: "646", name: "Droits d'enregistrement", type: "EXPENSE" },
                    { code: "648", name: "Autres impôts et taxes", type: "EXPENSE" },
                ]
            },
            {
                code: "66", name: "Charges de personnel", type: "EXPENSE", children: [
                    { code: "661", name: "Rémunérations du personnel national", type: "EXPENSE" },
                    { code: "662", name: "Rémunérations du personnel non national", type: "EXPENSE" },
                    { code: "663", name: "Indemnités forfaitaires versées au personnel", type: "EXPENSE" },
                    { code: "664", name: "Charges sociales", type: "EXPENSE" },
                ]
            },
            {
                code: "67", name: "Frais financiers et charges assimilées", type: "EXPENSE", children: [
                    { code: "671", name: "Intérêts des emprunts", type: "EXPENSE" },
                    { code: "674", name: "Pertes de change", type: "EXPENSE" },
                    { code: "676", name: "Pertes sur cessions de titres de placement", type: "EXPENSE" },
                ]
            },
            {
                code: "68", name: "Dotations aux amortissements", type: "EXPENSE", children: [
                    { code: "681", name: "Dotations aux amortissements d'exploitation", type: "EXPENSE" },
                    { code: "687", name: "Dotations aux amortissements à caractère financier", type: "EXPENSE" },
                ]
            },
            { code: "69", name: "Dotations aux provisions", type: "EXPENSE" },
        ]
    },
    {
        code: "7", name: "Comptes de produits des activités ordinaires", type: "INCOME", children: [
            {
                code: "70", name: "Ventes", type: "INCOME", children: [
                    { code: "701", name: "Ventes de marchandises", type: "INCOME" },
                    { code: "702", name: "Ventes de produits finis", type: "INCOME" },
                    { code: "704", name: "Ventes de prestations de services", type: "INCOME" },
                    { code: "706", name: "Produits des activités annexes", type: "INCOME" },
                ]
            },
            { code: "71", name: "Subventions d'exploitation", type: "INCOME" },
            { code: "72", name: "Production immobilisée", type: "INCOME" },
            { code: "73", name: "Variations de stocks de produits et en-cours", type: "INCOME" },
            { code: "75", name: "Autres produits", type: "INCOME" },
            {
                code: "77", name: "Revenus financiers et produits assimilés", type: "INCOME", children: [
                    { code: "771", name: "Intérêts de prêts", type: "INCOME" },
                    { code: "774", name: "Gains de change", type: "INCOME" },
                    { code: "776", name: "Gains de cessions de titres de placement", type: "INCOME" },
                ]
            },
            { code: "78", name: "Reprises d'amortissements et provisions", type: "INCOME" },
            { code: "79", name: "Reprises de provisions financières", type: "INCOME" },
        ]
    },
    {
        code: "8", name: "Comptes des autres charges et produits HAO", type: "EXPENSE", children: [
            { code: "81", name: "Valeurs comptables des cessions d'immobilisations", type: "EXPENSE" },
            { code: "82", name: "Produits des cessions d'immobilisations", type: "INCOME" },
            { code: "83", name: "Charges hors activités ordinaires", type: "EXPENSE" },
            { code: "84", name: "Produits hors activités ordinaires", type: "INCOME" },
            { code: "85", name: "Dotations HAO", type: "EXPENSE" },
            { code: "86", name: "Reprises HAO", type: "INCOME" },
            { code: "87", name: "Participation des travailleurs", type: "EXPENSE" },
            { code: "89", name: "Impôts sur le résultat", type: "EXPENSE" },
        ]
    },
]

const TEMPLATES = {
    'IFRS_COA': IFRS_COA,
    'LEBANESE_PCN': LEBANESE_PCN,
    'FRENCH_PCG': FRENCH_PCG,
    'USA_GAAP': USA_GAAP,
    'SYSCOHADA_REVISED': SYSCOHADA_REVISED
}

export async function importChartOfAccountsTemplate(templateKey: keyof typeof TEMPLATES, options?: { reset?: boolean }) {


    try {
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch('coa/apply_template/', {
            method: 'POST',
            body: JSON.stringify({
                template_key: templateKey,
                reset: options?.reset || false
            })
        })

        // NOTE: Do NOT call applySmartPostingRules() here.
        // At this point both old and new accounts coexist, so smart_apply
        // would pick wrong/old accounts. The correct call happens in
        // migrateBalances() AFTER old accounts are deactivated.

        try {
            revalidatePath('/finance/chart-of-accounts')
            revalidatePath('/finance/settings/posting-rules')
        } catch (e) {
            // Ignore
        }
        return { success: true }
    } catch (error) {
        console.error(`[COA_TEMPLATE] Import failed:`, error)
        throw error
    }
}

export async function getAllTemplates() {
    return TEMPLATES
}

export async function getTemplatePreview(templateKey: keyof typeof TEMPLATES) {
    return TEMPLATES[templateKey]
}

/**
 * MAPPING TOOL (Advanced)
 * Moves all balances from old accounts to new ones and deactivates old ones.
 */
export async function migrateBalances(data: { mappings: Record<string, any>[], description: string }) {

    try {
        const { erpFetch } = await import('@/lib/erp-api')
        const result = await erpFetch('coa/migrate/', {
            method: 'POST',
            body: JSON.stringify(data)
        })

        // Auto-apply smart posting rules after migration
        // so the posting rules page is pre-populated for the new standard
        try {
            await applyAutoDetect(70)
        } catch {
            // Non-critical — user can still manually map on the posting rules page
        }

        try {
            revalidatePath('/finance/chart-of-accounts')
            revalidatePath('/finance/settings/posting-rules')
        } catch {
            // Ignore
        }

        return result
    } catch (error) {
        console.error(`[COA_MIGRATE] Migration failed:`, error)
        throw error
    }
}

export async function sweepInactiveBalances(mapping: Record<string, any>) {
    throw new Error("Sweep logic must be moved to Django Backend via erpFetch.")
}

// ═══════════════════════════════════════════════════════════════
// Database-Backed COA Template Actions
// ═══════════════════════════════════════════════════════════════

export type DBTemplate = {
    key: string
    name: string
    region: string
    description: string
    icon: string
    accent_color: string
    is_system: boolean
    is_custom: boolean
    account_count: number
    posting_rule_count: number
}

export type DBTemplatePostingRule = {
    event_code: string
    account_code: string
    module: string
    description: string
}

/**
 * Fetch all COA templates from the database (system + custom for current org)
 */
export async function getDBTemplates(): Promise<DBTemplate[]> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        const data = await erpFetch('coa/db-templates/')
        return data || []
    } catch (error) {
        console.error('[COA_TEMPLATES_DB] Failed to fetch templates:', error)
        return []
    }
}

/**
 * Get full template detail with account tree
 */
export async function getDBTemplateDetail(templateKey: string) {
    const { erpFetch } = await import('@/lib/erp-api')
    return erpFetch(`coa/db-templates/${templateKey}/`)
}

/**
 * Preview posting rules for a template BEFORE importing it
 */
export async function getDBTemplatePostingRules(templateKey: string): Promise<{
    template_key: string
    template_name: string
    rules: DBTemplatePostingRule[]
    total: number
}> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch(`coa/db-templates/${templateKey}/posting-rules/`)
    } catch (error) {
        console.error('[COA_TEMPLATES_DB] Failed to fetch posting rules:', error)
        return { template_key: templateKey, template_name: '', rules: [], total: 0 }
    }
}

/**
 * Create a custom COA template for the current organization
 */
export async function createCustomTemplate(data: {
    key: string
    name: string
    region?: string
    description?: string
    accounts?: any[]
    posting_rules?: { event_code: string; account_code: string; description?: string }[]
}) {
    const { erpFetch } = await import('@/lib/erp-api')
    const result = await erpFetch('coa/db-templates/create/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
    revalidatePath('/finance/chart-of-accounts/templates')
    return result
}

/**
 * Update a custom COA template
 */
export async function updateCustomTemplate(templateKey: string, data: Record<string, any>) {
    const { erpFetch } = await import('@/lib/erp-api')
    const result = await erpFetch(`coa/db-templates/${templateKey}/update/`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
    revalidatePath('/finance/chart-of-accounts/templates')
    return result
}

/**
 * Delete a custom COA template (system templates cannot be deleted)
 */
export async function deleteCustomTemplate(templateKey: string) {
    const { erpFetch } = await import('@/lib/erp-api')
    const result = await erpFetch(`coa/db-templates/${templateKey}/delete/`, {
        method: 'DELETE'
    })
    revalidatePath('/finance/chart-of-accounts/templates')
    return result
}

// ═══════════════════════════════════════════════════════════════
// Migration Mapping Actions
// ═══════════════════════════════════════════════════════════════

export type MigrationMapPair = {
    source_key: string
    source_name: string
    target_key: string
    target_name: string
    mapping_count: number
}

export type MigrationMapping = {
    source_account_code: string
    target_account_code: string
    notes: string
}

/**
 * List all available migration map pairs (which template→template maps exist)
 */
export async function getMigrationMapsList(): Promise<MigrationMapPair[]> {
    try {
        const { erpFetch } = await import('@/lib/erp-api')
        return await erpFetch('coa/db-templates/migration-maps/')
    } catch {
        return []
    }
}

/**
 * Get a specific migration map between two templates
 */
export async function getMigrationMap(sourceKey: string, targetKey: string): Promise<{
    source_key: string
    target_key: string
    source_name: string
    target_name: string
    mappings: MigrationMapping[]
    total: number
}> {
    const { erpFetch } = await import('@/lib/erp-api')
    return erpFetch(`coa/db-templates/migration-maps/${sourceKey}/${targetKey}/`)
}

/**
 * Save migration mappings between two templates (create or update)
 */
export async function saveMigrationMap(data: {
    source_key: string
    target_key: string
    mappings: MigrationMapping[]
}) {
    const { erpFetch } = await import('@/lib/erp-api')
    return erpFetch('coa/db-templates/migration-maps/save/', {
        method: 'POST',
        body: JSON.stringify(data)
    })
}