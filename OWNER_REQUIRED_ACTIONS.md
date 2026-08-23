# MEOU owner-required actions

Only actions requiring the proprietor's identity, signature, contract or
private console are listed here. Engineering changes are tracked separately.

## 1. Confirm and publish the real operator identity

1. Provide the full registered IP name, INN, OGRNIP, registered/public contact
   address, support email and privacy-request email.
2. Confirm whether the public address may legally be published or provide the
   correct service address approved for notices.
3. Approve the final minimum age, retention schedule and legal bases with
   Russian counsel.
4. Put these exact values into the Railway/RF website variables listed in
   `.env.example`, including the real hosting, transactional email, support
   mailbox, geocoder and processing countries; save a screenshot/export of the
   values (secrets excluded).

**Release evidence:** signed operator-details sheet and production legal-page
PDFs with URL/date/hash. Until this is done, the production website build fails
closed and preview builds remain `noindex`.

## 2. File the Article 22 operator notification

1. Open [Roskomnadzor operator notification](https://pd.rkn.gov.ru/operators-registry/notification/) using the proprietor's verified account/signature.
2. Transfer the approved values from
   `docs/legal/RKN_OPERATOR_NOTIFICATION_DRAFT.md`.
3. Insert the real Russian hosting/DB provider, data-centre and backup locations;
   do not enter Railway as a Russian database.
4. Review every purpose/category/action and sign/submit.
5. Save the signed submission, receipt, status and later registry number.

## 3. File the separate Article 12 notice(s)

1. Decide with counsel which foreign services remain at launch. Railway API/DB
   must be removed; replacing Resend/geocoding is the fastest clean option.
2. Obtain each recipient's legal details, countries/subprocessors, retention,
   safeguards and data-subject request process.
3. Open [the cross-border procedure](https://pd.rkn.gov.ru/cross-border-transmission/) and transfer the approved recipient rows from
   `docs/legal/RKN_CROSS_BORDER_DRAFT.md`.
4. Submit **before** enabling the transfer; obey the current account status/
   waiting or restriction instruction.
5. Save each signed notice, receipt, status and recipient evidence pack.

## 4. Contract Russian production infrastructure

1. Authorise/provide access to the selected RF VDS/application platform,
   managed PostgreSQL, RF logs and RF backups.
2. Obtain a provider document stating the Russian data-centre and backup
   locations and sign the processing/security terms.
3. Approve the cutover window and final rollback deletion of Railway after the
   restore/smoke evidence passes.
4. Provide DNS access or apply the exact records produced by the cutover run;
   verify `api.tvoi-goroskop.ru` TLS before approving the Android release.

## 5. Complete private RuStore Console declarations

1. Choose one final public app name and ensure the installed APK title, MEOU
   website, listing and icon agree.
2. Fill the data-safety/permissions declaration from
   `RUSTORE_LEGAL_RELEASE_CHECKLIST.md`; do not select categories based only on
   Android Manifest permissions.
3. Enter the final website, Privacy Policy, Terms, account-deletion and support
   URLs after production verification.
4. Complete age rating/developer contacts and confirm first-release Premium is
   disabled unless the signed build and RuStore products are actually ready.
5. Sign/submit the release and save the declaration export/screenshots,
   moderation receipt and published store URL.
