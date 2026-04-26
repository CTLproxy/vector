# Key Management

```shell
# Create a key
curl -X POST https://vector-peach-beta.vercel.app/api/admin/keys \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"label": "My Phone"}'

# List all keys
curl https://vector-peach-beta.vercel.app/api/admin/keys \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"

# Revoke a key
curl -X DELETE "https://vector-peach-beta.vercel.app/api/admin/keys?key=abc123-def456-ghi789-jkl012" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```
