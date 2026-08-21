import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchDropdownComponent } from './search-dropdown.component';

describe('SearchDropdownComponent', () => {
  let component: SearchDropdownComponent<string>;
  let fixture: ComponentFixture<SearchDropdownComponent<string>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchDropdownComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchDropdownComponent<string>);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
