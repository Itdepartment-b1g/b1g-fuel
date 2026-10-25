INSERT INTO role_pages (role_id, page_key)
SELECT role_id, 'materialRequestReceiving'
FROM role_pages
WHERE page_key = 'materialRequests'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key, access_scope)
SELECT role_id, 'materialRequestReceiving.view', access_scope
FROM role_permissions
WHERE permission_key = 'materialRequests.view'
ON CONFLICT DO NOTHING;

INSERT INTO user_company_page (user_company_id, page_key)
SELECT user_company_id, 'materialRequestReceiving'
FROM user_company_page
WHERE page_key = 'materialRequests'
ON CONFLICT DO NOTHING;

INSERT INTO user_company_permission (user_company_id, permission_key, access_scope)
SELECT user_company_id, 'materialRequestReceiving.view', access_scope
FROM user_company_permission
WHERE permission_key = 'materialRequests.view'
ON CONFLICT DO NOTHING;
