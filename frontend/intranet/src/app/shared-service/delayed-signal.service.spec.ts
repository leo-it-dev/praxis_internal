import { TestBed } from '@angular/core/testing';

import { DelayedSignalService } from './delayed-signal.service';

describe('DelayedSignalService', () => {
  let service: DelayedSignalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DelayedSignalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
