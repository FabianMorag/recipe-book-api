import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export function configureOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Recipe Book API')
    .setDescription(
      'Backend API for Auth.js session authentication and recipe management.',
    )
    .setVersion('1.0')
    .addSecurity('authjs-session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'authjs.session-token',
      description:
        'Auth.js session cookie set by the backend OAuth flow. Secure deployments may use a __Secure- cookie prefix.',
    })
    .build()

  const documentFactory = () => SwaggerModule.createDocument(app, config)

  SwaggerModule.setup('docs', app, documentFactory, {
    jsonDocumentUrl: 'docs-json',
  })
}
