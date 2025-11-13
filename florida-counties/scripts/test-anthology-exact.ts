// test-anthology.ts - EXACT hardcoded request from PowerShell

const url =
  "https://sisclientweb-100192.campusnexus.cloud/ds/campusnexus/Students?$select=Id,CampusId,SchoolStatusId,ProgramId,StudentNumber,FullName,FirstName,LastName,PhoneNumber,StartDate&$expand=Campus($select=Name),Program($select=Name),SchoolStatus($select=Name),Person($expand=Addresses)&$filter=((StartDate ge 2025-11-08T05:00:00.0000000Z) and (StartDate le 2025-12-13T05:00:00.0000000Z)) and ((SchoolStatusId eq 13) or (SchoolStatusId eq 162) or (SchoolStatusId eq 150) or (SchoolStatusId eq 151) or (SchoolStatusId eq 155))&$count=true&$orderby=Campus/Name,FullName&$top=1000&$skip=0";

async function main() {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization:
        "Basic Y291cnNla2V5YXBpQHNvdXRoZXJudGVjaC5lZHU6U1RjLUFQSS0yMDIyIQ==",
    },
  });
  console.log("status:", res.status);
  const text = await res.text();
  console.log(text.slice(0, 500));
}

main().catch(console.error);

