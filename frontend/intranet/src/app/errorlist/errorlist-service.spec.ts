import { TestBed } from '@angular/core/testing';

import { ErrorlistService } from './errorlist.service';

describe('ErrorlistServiceService', () => {
  let service: ErrorlistService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorlistService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
