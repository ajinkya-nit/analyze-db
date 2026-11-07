# Used to sign up

curl -i -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AnalyzeDB Test User",
    "email": "test@analyzedb.local",
    "password": "Use-A-New-Strong-Test-Password-123!"
  }' \
  -c cookies.txt
