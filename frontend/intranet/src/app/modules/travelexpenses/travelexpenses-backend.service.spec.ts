import { TestBed } from '@angular/core/testing';

import { TravelexpensesBackendService } from './travelexpenses-backend.service';

describe('TravelexpensesBackendService', () => {
  let service: TravelexpensesBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TravelexpensesBackendService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
