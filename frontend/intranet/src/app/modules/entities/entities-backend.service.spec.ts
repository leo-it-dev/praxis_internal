import { TestBed } from '@angular/core/testing';

import { EntitiesBackendService } from './entities-backend.service';

describe('EntitiesBackendService', () => {
  let service: EntitiesBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EntitiesBackendService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
