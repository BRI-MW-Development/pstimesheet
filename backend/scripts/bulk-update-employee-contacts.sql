-- Bulk update employee email IDs and phone numbers from PS KSA Employee Details PDF
-- Run this against the DEV database (PSTsEmployeeProfile table)
-- Only updates emailId and phone; does NOT touch subDepartment, category, imageUrl

-- Ensure phone column exists
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('PSTsEmployeeProfile') AND name='phone')
  ALTER TABLE PSTsEmployeeProfile ADD phone NVARCHAR(30) NULL;
GO

-- Helper macro: MERGE a single employee row
-- Usage: one MERGE per employee

-- IT / Digital Division
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0158' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hossam@professional-signs.com',          phone='966566716428', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0158','hossam@professional-signs.com','966566716428');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0196' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='It@professional-signs.com',              phone='966552205851', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0196','It@professional-signs.com','966552205851');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0213' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='itspecialist@professional-signs.com',    phone='966552205424', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0213','itspecialist@professional-signs.com','966552205424');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0011' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Salim@professional-signs.com',           phone='966591508313', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0011','Salim@professional-signs.com','966591508313');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0170' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Samad@professional-signs.com',           phone='966590491012', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0170','Samad@professional-signs.com','966590491012');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0184' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='nisarahmed@professional-signs.com',      phone='966552381873', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0184','nisarahmed@professional-signs.com','966552381873');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0214' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='technicaldesign@professional-signs.com', phone='966555116549', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0214','technicaldesign@professional-signs.com','966555116549');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0100' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Naseem@professional-signs.com',          phone='966546412529', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0100','Naseem@professional-signs.com','966546412529');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0041' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='vinodh@professional-signs.com',          phone='966544635615', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0041','vinodh@professional-signs.com','966544635615');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0015' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='sajan@professional-signs.com',           phone='966540231972', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0015','sajan@professional-signs.com','966540231972');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0039' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='ramees@professional-signs.com',          phone='966542479782', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0039','ramees@professional-signs.com','966542479782');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0060' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='digisupport@professional-signs.com',     phone='966552203537', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0060','digisupport@professional-signs.com','966552203537');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0080' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='help@professional-signs.com',            phone=NULL,           updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0080','help@professional-signs.com',NULL);

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0111' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='muhammed.asif@professional-signs.com',   phone='966554717630', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0111','muhammed.asif@professional-signs.com','966554717630');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0124' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='rawan@professional-signs.com',           phone='966535557638', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0124','rawan@professional-signs.com','966535557638');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0152' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='digitaleng@professional-signs.com',      phone='966544635733', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0152','digitaleng@professional-signs.com','966544635733');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0193' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='digitalmaintenance@professional-signs.com', phone='966560846038', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0193','digitalmaintenance@professional-signs.com','966560846038');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0194' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='rgbsupport@professional-signs.com',      phone='966561623689', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0194','rgbsupport@professional-signs.com','966561623689');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0198' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='m.shahir@professional-signs.com',        phone='966537850542', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0198','m.shahir@professional-signs.com','966537850542');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0200' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='i.dennis@professional-signs.com',        phone='966561623562', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0200','i.dennis@professional-signs.com','966561623562');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0206' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Techsupport@professional-signs.com',     phone='966561624782', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0206','Techsupport@professional-signs.com','966561624782');

-- Finance / Accounts / Admin
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0006' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='finance@professional-signs.com',         phone='966540231142', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0006','finance@professional-signs.com','966540231142');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0191' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='accountsreceivables@professional-signs.com', phone='966552183814', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0191','accountsreceivables@professional-signs.com','966552183814');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0001' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='sajil@professional-signs.com',           phone='966591508392', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0001','sajil@professional-signs.com','966591508392');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0042' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='accounts@professional-signs.com',        phone=NULL,           updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0042','accounts@professional-signs.com',NULL);

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0061' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='admin@professional-signs.com',           phone=NULL,           updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0061','admin@professional-signs.com',NULL);

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0121' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='adminsupport@professional-signs.com',    phone='966535559348', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0121','adminsupport@professional-signs.com','966535559348');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0171' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hroperations@professional-signs.com',    phone=NULL,           updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0171','hroperations@professional-signs.com',NULL);

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0189' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='facilities3@professional-signs.com',     phone='966554513028', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0189','facilities3@professional-signs.com','966554513028');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0043' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hr@professional-signs.com',              phone='966555117249', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0043','hr@professional-signs.com','966555117249');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0054' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Saeed@professional-signs.com',           phone='966552201744', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0054','Saeed@professional-signs.com','966552201744');

-- Installation / Maintenance
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0002' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='sharifhossain@professional-signs.com',   phone='966590490948', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0002','sharifhossain@professional-signs.com','966590490948');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0003' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId=NULL,                                     phone='966591508363', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0003',NULL,'966591508363');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0007' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId=NULL,                                     phone='966544635746', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0007',NULL,'966544635746');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0008' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='maintenance@professional-signs.com',     phone=NULL,           updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0008','maintenance@professional-signs.com',NULL);

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0009' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Installation@professional-signs.com',    phone='966565260656', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0009','Installation@professional-signs.com','966565260656');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0010' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId=NULL,                                     phone='966544635598', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0010',NULL,'966544635598');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0012' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId=NULL,                                     phone='966552025102', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0012',NULL,'966552025102');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0040' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='sitesurveyor@professional-signs.com',    phone='966552025944', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0040','sitesurveyor@professional-signs.com','966552025944');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0084' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId=NULL,                                     phone='966563345416', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0084',NULL,'966563345416');

-- HR / Admin contacts
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0075' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Hyder@professional-signs.com',           phone='966537850543', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0075','Hyder@professional-signs.com','966537850543');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0163' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='shahir@professional-signs.com',          phone='966544635740', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0163','shahir@professional-signs.com','966544635740');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0230' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hrsupport@professional-signs.com',       phone=NULL,           updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0230','hrsupport@professional-signs.com',NULL);

-- Production
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0037' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='production@professional-signs.com',      phone='966552201152', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0037','production@professional-signs.com','966552201152');

-- BIM / Production support
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0173' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hari@professional-signs.com',            phone='966590491652', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0173','hari@professional-signs.com','966590491652');

-- Projects
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0013' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='shameer@professional-signs.com',         phone='966540227102', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0013','shameer@professional-signs.com','966540227102');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0017' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='arjuncp@professional-signs.com',         phone='966540231272', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0017','arjuncp@professional-signs.com','966540231272');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0014' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Yasir@professional-signs.com',           phone=NULL,           updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0014','Yasir@professional-signs.com',NULL);

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0069' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId=NULL,                                     phone='966531520251', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0069',NULL,'966531520251');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0086' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='althaf@professional-signs.com',          phone='966540619792', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0086','althaf@professional-signs.com','966540619792');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0089' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='projectcoordinator@professional-signs.com', phone='966535557298', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0089','projectcoordinator@professional-signs.com','966535557298');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0095' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='projectplanner@professional-signs.com',  phone='966563526587', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0095','projectplanner@professional-signs.com','966563526587');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0098' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='almer@professional-signs.com',           phone='966535552871', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0098','almer@professional-signs.com','966535552871');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0101' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Georbin@professional-signs.com',         phone='966552201707', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0101','Georbin@professional-signs.com','966552201707');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0118' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='jr.doccontroller@professional-signs.com', phone='966563345403', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0118','jr.doccontroller@professional-signs.com','966563345403');

-- HSE / QC / Safety
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0122' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='safetyofficer@professional-signs.com',   phone='966562743817', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0122','safetyofficer@professional-signs.com','966562743817');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'T000' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hseofficer@professional-signs.com',      phone='966561581102', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('T000','hseofficer@professional-signs.com','966561581102');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0132' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='qcinspector@professional-signs.com',     phone='966539782492', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0132','qcinspector@professional-signs.com','966539782492');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0226' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hse@professional-signs.com',             phone='966541257338', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0226','hse@professional-signs.com','966541257338');

-- Design / Planning / Documents
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0135' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='harikrishnan@professional-signs.com',    phone='966595756375', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0135','harikrishnan@professional-signs.com','966595756375');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0136' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='anu@professional-signs.com',             phone='966552204360', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0136','anu@professional-signs.com','966552204360');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0146' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='psc.planner@professional-signs.com',     phone='966565169634', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0146','psc.planner@professional-signs.com','966565169634');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0147' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='docsupport@professional-signs.com',      phone='966565304262', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0147','docsupport@professional-signs.com','966565304262');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0150' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Environmental@professional-signs.com',   phone='966551620252', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0150','Environmental@professional-signs.com','966551620252');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0157' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='salman@professional-signs.com',          phone='966565311303', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0157','salman@professional-signs.com','966565311303');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0167' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='Sameeruddin@professional-signs.com',     phone='966595756364', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0167','Sameeruddin@professional-signs.com','966595756364');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0174' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='usman@professional-signs.com',           phone='966552205107', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0174','usman@professional-signs.com','966552205107');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0177' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='eric@professional-signs.com',            phone='966561551568', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0177','eric@professional-signs.com','966561551568');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0190' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='abunassar@professional-signs.com',       phone='966561582460', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0190','abunassar@professional-signs.com','966561582460');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0207' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='leo@professional-signs.com',             phone='966536097203', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0207','leo@professional-signs.com','966536097203');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0209' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='yaseen@professional-signs.com',          phone='966561625232', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0209','yaseen@professional-signs.com','966561625232');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0210' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='doccontroller@professional-signs.com',   phone='966562771624', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0210','doccontroller@professional-signs.com','966562771624');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0211' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='farhan@professional-signs.com',          phone='966561552985', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0211','farhan@professional-signs.com','966561552985');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0232' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='projectsupport@professional-signs.com',  phone='966561624776', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0232','projectsupport@professional-signs.com','966561624776');

-- General / Senior management
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0004' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='suhail@professional-signs.com',          phone='966592586294', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0004','suhail@professional-signs.com','966592586294');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0079' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='sefeer@professional-signs.com',          phone='966544635766', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0079','sefeer@professional-signs.com','966544635766');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0178' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='abbas@professional-signs.com',           phone='966561566157', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0178','abbas@professional-signs.com','966561566157');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0081' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='nishad@professional-signs.com',          phone='966555117926', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0081','nishad@professional-signs.com','966555117926');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0164' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='zainul@professional-signs.com',          phone='966535552487', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0164','zainul@professional-signs.com','966535552487');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0159' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='hemachandran@professional-signs.com',    phone='966590490683', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0159','hemachandran@professional-signs.com','966590490683');

-- Procurement / Inventory
MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0034' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='procurement@professional-signs.com',     phone='966563812793', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0034','procurement@professional-signs.com','966563812793');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0035' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='inventory@professional-signs.com',       phone='966542498592', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0035','inventory@professional-signs.com','966542498592');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0047' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId='ebtehal@professional-signs.com',         phone='966552202867', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0047','ebtehal@professional-signs.com','966552202867');

MERGE PSTsEmployeeProfile AS t USING (SELECT 'PSE0070' AS e) AS s ON t.employeeNo=s.e
WHEN MATCHED THEN UPDATE SET emailId=NULL,                                     phone='966562779836', updatedAt=GETDATE()
WHEN NOT MATCHED THEN INSERT (employeeNo,emailId,phone) VALUES ('PSE0070',NULL,'966562779836');

-- Verify results
SELECT employeeNo, emailId, phone, updatedAt
FROM PSTsEmployeeProfile
WHERE emailId IS NOT NULL OR phone IS NOT NULL
ORDER BY employeeNo;
