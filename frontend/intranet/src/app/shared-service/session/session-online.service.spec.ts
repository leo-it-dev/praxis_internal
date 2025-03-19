import { TestBed } from '@angular/core/testing';

import { SessionOnlineService } from './session-online.service';

describe('SessionOnlineService', () => {
  let service: SessionOnlineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionOnlineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
