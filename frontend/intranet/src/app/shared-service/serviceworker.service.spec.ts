import { TestBed } from '@angular/core/testing';

import { ServiceworkerService } from './serviceworker.service';

describe('ServiceworkerService', () => {
  let service: ServiceworkerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServiceworkerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
