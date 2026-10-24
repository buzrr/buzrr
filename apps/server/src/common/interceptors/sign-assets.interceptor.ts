import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { signAssetsDeep } from "../storage/asset-signing";

/**
 * Signs uploaded-media URLs in REST responses — only for authenticated
 * requests (a signed-in user or a player token), so public endpoints never
 * hand out a working link. Each endpoint's own authorisation decides what the
 * caller may see; this only makes those links loadable.
 */
@Injectable()
export class SignAssetsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest<{ user?: unknown }>();
    if (!req.user) return next.handle();
    return next.handle().pipe(map((body) => signAssetsDeep(body)));
  }
}
