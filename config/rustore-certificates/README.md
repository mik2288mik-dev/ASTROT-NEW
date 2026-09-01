# RuStore API certificate chain

The production image installs the Russian Trusted root and intermediate
certificates required by RuStore's `-m` API hosts. The PEM files were retrieved
on 2026-09-01 from the official URLs referenced by RuStore:

- `https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt`
- `https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt`

Owner-reviewed X.509 SHA-256 fingerprints:

- root: `D2:6D:2D:02:31:B7:C3:9F:92:CC:73:85:12:BA:54:10:35:19:E4:40:5D:68:B5:BD:70:3E:97:88:CA:8E:CF:31`
- intermediate: `BB:BD:E2:10:3E:79:0B:99:9E:C6:2B:D0:3C:F6:25:A5:A2:E7:C3:16:E1:0A:FE:6A:49:0E:ED:EA:D8:B3:FD:9B`

The intermediate certificate expires on 2027-03-06. The release validator must
reject an expired or near-expiry chain, so replace it from the official source
before that date rather than bypassing validation.
