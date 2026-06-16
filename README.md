# Wrangle: Decentralized Medical Data Marketplace

**Wrangle** is a decentralized application (dApp) designed to empower individuals to **monetize their healthcare data** while maintaining full sovereignty over who accesses it. By leveraging blockchain technology and decentralized storage, the platform bridges the gap between patient privacy and the data needs of medical research institutions.

---

##  General Overview

In the current healthcare landscape, patient data is often siloed or sold by third parties without the patient’s direct consent or profit. **Sovereign Health** changes this dynamic by:

- **Empowering Users:** Individuals can upload their healthcare records, encrypt them, and choose to list them for sale.
- **Facilitating Research:** Institutions and data brokers can browse curated datasets or broadcast custom requests for specific data types (e.g., *Diabetes patients, aged 30–50*).
- **Ensuring Privacy:** Data is never stored "in the clear." It is encrypted before being stored on a decentralized network, and access is only granted via cryptographic permissions.
- **Automated Payments:** All transactions, including fee distribution between data owners and curators, are handled automatically by smart contracts using USDC.

---

## Technical Architecture

Sovereign Health integrates three core decentralized technologies to ensure security, scalability, and privacy:

### 1. Data Storage & Encryption
- **Walrus Protocol:** Used as the decentralized blob storage layer for healthcare data files.
- **Seal:** Handles the encryption of data before it is uploaded to Walrus and manages the decryption process only when authorized access is confirmed.
- **Metadata Management:** The system maintains record types, dates, and anonymization levels to help researchers filter data without compromising patient identity.

### 2. Sui Move Smart Contracts
The core logic is deployed as a **Sui Move package** responsible for:

- **Access Control:** Defining granular access policies that are **token-gated** and fully **revocable**.
- **Immutable Logging:** Every instance of data access or permission change is logged on the Sui blockchain, creating a transparent audit trail.
- **Policy Enforcement:** Ensuring that only users who have fulfilled payment or meeting specific criteria can trigger decryption through Seal.

### 3. Marketplace Logic & Payments
The marketplace operates on the **Sui Testnet** using **USDC**:

- **Escrow System:** Fees for data requests are held in escrow by smart contracts until the data is provided.
- **Compensation Splits:** The contract automatically distributes payments, typically splitting fees between the individual user (data owner) and the dataset curator.
- **Refund Mechanism:** If a custom data request is not fulfilled within a set timeframe, the institution is automatically refunded.

---

## Key Workflows

### Curated Dataset Sale
A user or curator lists a pre-packaged dataset with a specific price. An institution can purchase access directly, which triggers an on-chain event granting them the rights to decrypt the data via Seal.

### Custom Dataset Request
1. **Request:** An institution broadcasts a request for specific data (metadata-based) along with a fee.
2. **Response:** Users matching the criteria can opt-in by granting access to their personal records.
3. **Execution:** Upon granting access, the payment is split: the user receives their portion, the curator receives their commission, and the institution receives access.
4. **Logging:** The entire transaction and subsequent data access are recorded immutably.

---

##  Roles in Wrangle

| Role        | Capabilities                                                                 |
|-------------|-------------------------------------------------------------------------------|
| Patient     | Upload records, encrypt data, grant/revoke access, receive payments           |
| Curator     | Aggregate datasets, list curated packages, earn commission on sales           |
| Institution | Browse datasets, broadcast custom requests, purchase access via USDC escrow   |




