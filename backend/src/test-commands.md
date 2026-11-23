# Used to sign up

curl -i -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AnalyzeDB Test User",
    "email": "test@analyzedb.local",
    "password": "Use-A-New-Strong-Test-Password-123!"
  }' \
  -c cookies.txt

# check authentication

curl.exe -i -b ".\cookies.txt" "$baseUrl/api/me"

# to create project

curl -i -b cookies.txt -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AnalyzeDB Demo",
    "description": "My first AnalyzeDB project"
  }'

# TO update project 

curl -i -b cookies.txt -X PATCH \
  http://localhost:3000/api/projects/YOUR_PROJECT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description for AnalyzeDB"
  }'

# to delete project


# project commands

$projectId = "e999f47c-92dc-4231-b9cd-c4524e5dc166"
$connectionId = "6a880969-8cb3-48e6-b85b-a0b22f972dd8"

$baseUrl = "http://localhost:3000/api/projects/$projectId/connections/$connectionId/schema"