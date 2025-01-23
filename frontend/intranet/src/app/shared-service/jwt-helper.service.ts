import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class JwtHelperService {
  constructor() { }

  parseJWTtoken(jwtString: string): {'header': string, 'content': {string:any}, 'hash': string} {
    let [header, content, hash] = jwtString.split(".");
    
    const headerParsed = JSON.parse(atob(header));
    const contentParsed = JSON.parse(atob(content));
    
    return {'header': headerParsed, 'content': contentParsed, 'hash': hash};
  }
}
