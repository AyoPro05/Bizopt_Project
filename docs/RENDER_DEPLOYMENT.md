# BizOpt Production Deployment Guide

**Status:** ✅ Production-ready for Render deployment  
**Last Updated:** 2026-06-07  
**Target:** Render (render.com)

## Pre-Deployment Checklist

### 🔐 Secrets & Configuration
- [ ] All env vars from `.env.example` collected and verified
- [ ] `NEXTAUTH_SECRET` generated (32+ chars): `openssl rand -base64 32`
- [ ] `DEVICE_SECRET` generated: `openssl rand -base64 32`
- [ ] Stripe keys verified (test keys for staging, live keys for production)
- [ ] Database URL pointing to managed PostgreSQL
- [ ] OpenAI API key optional (gracefully degrades to templates)

### 🗄️ Database
- [ ] PostgreSQL instance provisioned (Render managed or external)
- [ ] Database accessible from Render deployment
- [ ] `DATABASE_URL` env var set
- [ ] Prisma migrations applied: `npx prisma db push`
- [ ] Seed data loaded: `npm run db:seed`
- [ ] Verify seed completed successfully in logs

### 🔗 OAuth & Auth
- [ ] NextAuth configured with secure callback URLs
- [ ] NextAuth secret is different from device secret
- [ ] Allowed redirect URLs updated for production domain
- [ ] Consider disabling demo OAuth in production

### 💳 Stripe Setup
- [ ] Webhook endpoint configured in Stripe dashboard
- [ ] Webhook pointing to: `https://your-domain.com/api/stripe/webhook`
- [ ] Webhook secret saved in `STRIPE_WEBHOOK_SECRET` env var
- [ ] Trial pricing IDs configured
- [ ] Subscription pricing IDs configured
- [ ] Test webhook delivery working

### 🌐 Domain & DNS
- [ ] Custom domain acquired (or use Render's provided domain)
- [ ] DNS configured (if custom domain)
- [ ] SSL certificate auto-provisioned by Render
- [ ] `NEXT_PUBLIC_APP_URL` updated to production domain
- [ ] Update Stripe OAuth callback URLs for production domain

## Render Deployment Steps

### 1. Connect Repository
```bash
# On Render dashboard:
- Click "New +" → "Web Service"
- Select GitHub repository: AyoPro05/Bizopt_Project
- Confirm main branch
```

### 2. Configure Service
```
Name: bizopt
Environment: Node
Build Command: npm run build
Start Command: npm run start
```

### 3. Set Environment Variables
Add all variables from `.env.example` to Render dashboard:
```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generated-secret>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
... (see .env.example for full list)
```

### 4. Deploy
```
- Click "Create Web Service"
- Render auto-deploys from main branch
- Monitor deployment logs at Render dashboard
```

### 5. Verify Deployment
```bash
# Test deployment
curl https://your-domain.com/api/health || echo "API ready"

# Check logs
# Render dashboard → Logs tab

# Test key features
- Login: https://your-domain.com/login
- Home: https://your-domain.com/home
- API: https://your-domain.com/api/openapi
```

## Post-Deployment

### 🔍 Monitoring
1. **Error Tracking** (Recommended)
   - Install Sentry: `npm install @sentry/nextjs`
   - Configure DSN in env vars
   - Track production errors

2. **Uptime Monitoring**
   - Configure Render alerts
   - Set up external monitoring (Uptime Robot, etc.)

3. **Logs**
   - View real-time logs in Render dashboard
   - Stream logs to centralized logging (optional)

### 📊 Analytics & Observability
1. **Product Analytics**
   - Consider PostHog, Mixpanel, or Amplitude
   - Track user flows and feature usage

2. **Performance Monitoring**
   - Monitor Next.js Core Web Vitals
   - Use Render metrics dashboard

### 🎯 Feature Flags & Testing
- Consider feature flags for gradual rollout
- Use A/B testing framework for new features
- Monitor error rates and performance metrics

## Troubleshooting

### "Cannot find module" errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

### Database connection timeout
- Verify DATABASE_URL format
- Check firewall rules in database
- Verify credentials are correct
- Test connection locally first

### Stripe webhook not hitting
- Verify webhook secret matches
- Check callback URL in Stripe dashboard
- Review Render logs for 401/403 errors

### Auth issues
- Verify NEXTAUTH_URL matches production domain
- Check callback URLs in OAuth providers
- Verify NEXTAUTH_SECRET is set and consistent

### Performance issues
- Check Next.js build size
- Monitor database query performance
- Review Render resource allocation
- Consider upgrading plan if needed

## Security Checklist

- [ ] All secrets rotated from test values
- [ ] HTTPS enforced (Render default)
- [ ] CSP headers verified in next.config.ts
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] Sensitive routes protected
- [ ] Database backups configured
- [ ] Environment variables never logged
- [ ] OAuth state validation enabled

## Scaling Considerations

- **Current limits**: 1 device per subscription (by design)
- **Database**: Monitor connections, add indexes as needed
- **API rate limits**: Currently 15 req/min per IP
- **Storage**: S3 optional, local storage included
- **Workers**: Background jobs may need scaling

## Rollback Plan

If deployment has critical issues:
```
1. Identify last working commit
2. Render dashboard → Environment → Redeploy commit
3. Or revert in GitHub and push new commit
```

## Support & Documentation

- **Project Docs**: `/docs/README.md`
- **Architecture**: `/docs/ARCHITECTURE.md`
- **OpenAPI Spec**: `GET /api/openapi`
- **Mobile Guide**: `/docs/APPLE.md`
- **PRD**: `/docs/PRD.md`

---

**Ready to deploy?** ✨

1. Verify all checklist items
2. Set environment variables in Render
3. Deploy from Render dashboard
4. Monitor logs for errors
5. Test core features
6. Celebrate! 🎉
