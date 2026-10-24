/** Fictional documents, one per nature (no real person, company or number). The text is what a PDF's text layer would give. */
export const RECEIPT = `Revenu Québec
Inscription d’une entreprise en démarrage
Accusé de réception
Numéro de référence : RQ-2026-0042
Date de l’inscription : 12 octobre 2026
Nom de l’entreprise : Atelier Boréal enr.
Numéro d’entreprise du Québec (NEQ) : 1170000001
Adresse du domicile : 123, rue des Érables, Montréal (Québec) H2X 1Y4
Téléphone : 514 555-0142
Courriel : exemple@example.test
NAS : XXX XXX 123
`;

export const INVOICE = `FACTURE / INVOICE
ÉMETTEUR / ISSUED BY :
Atelier Boréal inc.
Numéro d'inscription TPS / GST : 123456789 RT 0001
Numéro d'inscription TVQ / QST : 1234567890 TQ 0001
Facture no : F-2026-0042
Date de la facture : 2026-10-12
Échéance : 2026-11-11
Conception du site Web           4 000,00 $
Sous-total                       4 000,00 $
TPS (5 %)                          200,00 $
TVQ (9,975 %)                      399,00 $
Total dû                         4 599,00 $
Conditions de paiement : 30 jours
`;

export const LEASE = `BAIL DE LOGEMENT — 3½, avenue du Parc, Montréal
Locateur : Madame Hélène Roy, 120, avenue du Parc
Locataire : Monsieur Karim Haddad
Durée : 12 mois, du 1er septembre 2026 au 31 août 2027.
Loyer mensuel : 1 120 $, payable le premier jour du mois.
`;

export const CONTRACT = `CONTRAT DE SERVICES
Entre Studio Nordik inc. (le prestataire) et Boulangerie du Plateau inc. (le client).
Prestataire : Studio Nordik inc.
Client : Boulangerie du Plateau inc.
Le prestataire cède au client ses droits d'auteur sur les livrables.
Signé à Montréal le 12 octobre 2026.
`;

export const PAY_STUB = `TALON DE PAIE
Employeur : Atelier Boréal inc.
Employé : Camille Fictive
Période : du 2026-10-01 au 2026-10-15
Salaire brut 2 100,00 $
RRQ 130,00 $
Assurance-emploi 34,00 $
Salaire net 1 650,00 $
`;

export const BANK_STATEMENT = `RELEVÉ DE COMPTE
Titulaire : Camille Fictive
Transit 12345 Institution 001
Solde d'ouverture 1 200,00 $
Dépôt 2 100,00 $
Retrait 800,00 $
Solde de clôture 2 500,00 $
`;

/** A fictitious notice of a visit (ADR-089's blank template, filled): a landlord's 24-hour notice, not a lease. */
export const VISIT_NOTICE = `AVIS DE VISITE DU LOGEMENT
Locateur : Madame Hélène Roy, 120, avenue du Parc
Locataire : Monsieur Karim Haddad
Date de l'avis : 2026-10-20
Visite prévue le 2026-10-28, entre 9 h et 12 h.
Préavis de 24 heures, conformément à l'article 1933 du Code civil du Québec.
`;

/** A fictitious état des lieux d'entrée (the move-in condition report), not a lease. */
export const PREMISES_CONDITION = `ÉTAT DES LIEUX D'ENTRÉE
Logement : 3½, avenue du Parc, Montréal
Locateur : Madame Hélène Roy
Locataire : Monsieur Karim Haddad
Date de l'entrée en jouissance : 2026-09-01
Salon : murs en bon état, plancher de bois franc sans égratignure.
Cuisine : comptoir endommagé près de l'évier.
`;

/** The English move-in condition report of the same premises. */
export const ENGLISH_CONDITION_REPORT = `CONDITION REPORT — MOVE-IN INSPECTION
Landlord: Hélène Roy
Tenant: Karim Haddad
Date of move-in: 2026-09-01
Living room: walls in good condition, no scratches on the hardwood floor.
Kitchen: countertop damaged near the sink.
`;

export const ID_CARD = `PERMIS DE CONDUIRE
Date de naissance : 1990-05-17
`;

export const ENGLISH_INVOICE = `INVOICE
Invoice number: INV-77
Invoice date: October 12, 2026
Subtotal 100.00 $
GST 5.00 $
Total due 105.00 $
Payment terms: net 30
`;

export const NOTHING = `Notes de réunion\nDiscussion sur le menu de la semaine.\n`;
