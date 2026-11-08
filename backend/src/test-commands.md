# Used to sign up

curl -i -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AnalyzeDB Test User",
    "email": "test@analyzedb.local",
    "password": "Use-A-New-Strong-Test-Password-123!"
  }' \
  -c cookies.txt


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

curl -i -b cookies.txt -X DELETE \
  http://localhost:3000/api/projects/YOUR_PROJECT_IDcurl -i http://localhost:3000/api/projects