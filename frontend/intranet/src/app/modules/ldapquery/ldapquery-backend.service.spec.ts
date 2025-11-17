import { TestBed } from '@angular/core/testing';

import { LdapqueryBackendService } from './ldapquery-backend.service';

describe('LdapqueryBackendService', () => {
  let service: LdapqueryBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LdapqueryBackendService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
